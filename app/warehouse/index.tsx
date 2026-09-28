import { ResponsiveGrid } from '../../components/ResponsiveGrid';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { createWarehouseJob, fetchDeliveryOrders, fetchMaterials, fetchPurchaseOrders, fetchVendors, fetchWarehouseJobs, previewWarehouseShipmentFile } from '../../services/api';
import { uploadWarehousePackagingPhoto, type UploadFile } from '../../services/uploadService';
import { Driver, Material, PurchaseOrder, Vehicle, Vendor, WarehouseJob } from '@/store/types';
import { useAuthStore } from '@/store/authStore';
import { isActiveJob } from '../../utils/jobStatus';
import { normalizeRole } from '../../utils/access';

type DraftLine = { id: string; productName: string; quantity: string; unit: string; source?: string; mrfNo?: string; additionalNotes?: string; sourceData?: Record<string, string> };
type PackagingPhoto = UploadFile & { displayName: string };
type DispatchMethod = 'purchase_order' | 'file_upload';
const REQUIRED_CSV_COLUMNS = ['Description', 'Quantity', 'Unit', 'MRF No.', 'Additional Notes'];
const SPREADSHEET_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
const UNIT_OPTIONS = [
  { id: 'tonnes', name: 'Tonnes' },
  { id: 'kilograms', name: 'Kilograms' },
  { id: 'bags', name: 'Bags' },
  { id: 'pieces', name: 'Pieces' },
  { id: 'litres', name: 'Litres' },
  { id: 'metres', name: 'Metres' },
];

function makeLine(): DraftLine {
  return { id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, productName: '', quantity: '', unit: 'tonnes' };
}

function purchaseOrderReference(job: WarehouseJob) {
  if (job.poNumber) return job.poNumber;
  return String(job.warehouseReference || '').split('/').slice(0, 2).join('/');
}

export default function WarehouseQueueScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const [jobs, setJobs] = useState<WarehouseJob[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dispatchMethod, setDispatchMethod] = useState<DispatchMethod>('purchase_order');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([makeLine()]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvPreviewError, setCsvPreviewError] = useState('');
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(true);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [packagingPhoto, setPackagingPhoto] = useState<PackagingPhoto | null>(null);
  const [uploadingPhotoJobId, setUploadingPhotoJobId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [expandedProductJobIds, setExpandedProductJobIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    const [warehouseJobs, deliveryData, purchaseOrderData, materialData, vendorData] = await Promise.all([
      fetchWarehouseJobs(),
      fetchDeliveryOrders(),
      fetchPurchaseOrders(),
      fetchMaterials(),
      fetchVendors(),
    ]);
    setJobs(warehouseJobs as WarehouseJob[]);
    setDeliveries(deliveryData);
    setPurchaseOrders(purchaseOrderData as PurchaseOrder[]);
    setMaterials(materialData as Material[]);
    setVendors(vendorData as Vendor[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedVendor = vendors.find((vendor) => vendor.id === vendorId);
  const visibleJobs = useMemo(
    () => normalizeRole(user?.role) === 'operator_warehouse'
      ? jobs.filter((job) => job.createdByUid === user?.uid)
      : jobs,
    [jobs, user?.role, user?.uid],
  );
  const todaysJobs = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return visibleJobs.filter((job: any) => !job.dispatchedToSiteAt && job.submittedAt && new Date(job.submittedAt) >= startOfToday);
  }, [visibleJobs]);
  const selectedPurchaseOrder = purchaseOrders.find((order) => order.id === purchaseOrderId);
  const warehouseMaterialIds = useMemo(
    () => new Set(materials
      .filter((material) => material.isWarehouseMaterial)
      .flatMap((material) => [material.id, (material as any).materialId])
      .filter(Boolean)
      .map((id) => String(id).trim().toLowerCase())),
    [materials],
  );
  const warehousePurchaseOrders = useMemo(
    () => purchaseOrders.filter((order) =>
      order.status !== 'cancelled' && (order.isWarehouseMaterial || [order, ...(order.materials || [])].some((line) => warehouseMaterialIds.has(String(line.materialId || '').trim().toLowerCase()))),
    ),
    [purchaseOrders, warehouseMaterialIds],
  );

  const resetSheet = () => {
    setDispatchMethod('purchase_order');
    setPurchaseOrderId('');
    setVendorId('');
    setLines([makeLine()]);
    setCsvFileName('');
    setCsvPreviewError('');
    setCsvPreviewOpen(true);
    setCsvHeaders([]);
    setPackagingPhoto(null);
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetVisible(false);
    resetSheet();
  };

  const selectPurchaseOrder = (id: string) => {
    const order = purchaseOrders.find((entry) => entry.id === id);
    setPurchaseOrderId(id);
    setVendorId(order?.vendorId || '');
  };

  const updateLine = (id: string, changes: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
  };

  const selectSpreadsheet = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: SPREADSHEET_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset || !/\.(csv|xlsx)$/i.test(asset.name || '')) {
        Alert.alert('Spreadsheet upload', 'Select a CSV or Excel .xlsx file.');
        return;
      }

      setDispatchMethod('file_upload');
      setCsvFileName(asset.name || 'warehouse-delivery.csv');
      const preview = await previewWarehouseShipmentFile(asset);
      const previewLines = preview.rows.map((row, index) => ({
        id: `upload-${Date.now()}-${index}`,
        productName: row.item.productName,
        quantity: row.item.quantity,
        unit: row.item.unit || 'tonnes',
        source: row.item.source,
        mrfNo: row.item.mrfNo,
        additionalNotes: row.item.additionalNotes,
        sourceData: row.item.sourceData,
      }));
      setLines(previewLines);
      setCsvHeaders(preview.headers || []);
      setCsvPreviewOpen(true);
      setCsvPreviewError(preview.counts.invalid ? 'Review the preview: every row needs a description and quantity greater than zero.' : '');
    } catch (error: any) {
      Alert.alert('Spreadsheet upload', error?.message || 'Could not preview this file.');
    }
  };

  const capturePackagingPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Camera access is required to capture the packaging photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPackagingPhoto({
        uri: asset.uri,
        name: asset.fileName || `warehouse-packaging-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        displayName: asset.fileName || 'Captured receipt photo',
      });
    } catch (error: any) {
      Alert.alert('Capture failed', error?.message || 'Could not capture the receipt photo.');
    }
  };

  const choosePackagingPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library permission needed', 'Allow photo library access to select the receipt photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPackagingPhoto({
      uri: asset.uri,
      name: asset.fileName || `warehouse-packaging-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      displayName: asset.fileName || 'Selected shipment photo',
    });
  };

  const attachMissingPackagingPhoto = async (job: WarehouseJob) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library permission needed', 'Allow photo library access to attach the required packaging photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const file: UploadFile = {
      uri: asset.uri,
      name: asset.fileName || `warehouse-packaging-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    };
    setUploadingPhotoJobId(job.id);
    try {
      const uploaded = await uploadWarehousePackagingPhoto(job.id, file);
      setJobs((current) => current.map((entry) => entry.id === job.id ? {
        ...entry,
        packagingPhotoURL: uploaded.photoURL,
        packagingPhotoFileName: file.name,
      } : entry));
      Alert.alert('Packaging photo attached', `${job.jobId} is now available for site acceptance, then inspection.`);
    } catch (error: any) {
      Alert.alert('Could not attach photo', error?.message || 'Please try again.');
    } finally {
      setUploadingPhotoJobId(null);
    }
  };

  const hasValidShipmentLines = lines.length > 0 &&
    lines.every((line) => line.productName.trim() && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0);
  const canSubmit = Boolean(
    purchaseOrderId &&
    hasValidShipmentLines &&
    !csvPreviewError &&
    (dispatchMethod === 'file_upload' || packagingPhoto),
  );

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Complete the submission', 'Choose the purchase order and confirm each product has a description and quantity greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const job = await createWarehouseJob({
        purchaseOrderId,
        vendorId,
        workflowType: dispatchMethod === 'file_upload' ? 'bulk_upload' : 'manual_purchase_order',
        goodsDeliveryNoteSource: dispatchMethod === 'file_upload' ? 'spreadsheet' : 'manual',
        goodsDeliveryNoteFileName: csvFileName,
        goodsDeliveryNoteHeaders: csvHeaders,
        items: lines.map((line) => ({
          productName: line.productName.trim(),
          quantity: Number(line.quantity),
          unit: line.unit.trim() || 'tonnes',
          source: String(line.source || 'Warehouse').trim(),
          description: line.productName.trim(),
          mrfNo: String(line.mrfNo || '').trim(),
          additionalNotes: String(line.additionalNotes || '').trim(),
          sourceData: line.sourceData || {},
        })),
        createdByUid: user?.uid || '',
        createdByName: user?.displayName || user?.email || '',
      }) as WarehouseJob;
      let completedJob = job;
      if (packagingPhoto && dispatchMethod === 'purchase_order') {
        const uploaded = await uploadWarehousePackagingPhoto(job.id, packagingPhoto);
        completedJob = {
          ...job,
          packagingPhotoURL: uploaded.photoURL,
          packagingPhotoFileName: packagingPhoto.name,
        };
      }
      setJobs((current) => current.filter((entry) => entry.id !== completedJob.id));
      setSheetVisible(false);
      resetSheet();
      Alert.alert(
        'Warehouse delivery submitted',
        `${job.jobId}\nThe delivery is now on the Site Schedule for acceptance, then inspection.`,
      );
    } catch (error: any) {
      Alert.alert('Could not submit delivery', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderJob = ({ item }: { item: WarehouseJob }) => (
    <View style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>

      <View style={styles.assignmentRow}>
        <Ionicons name="business-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.assignmentText, { color: colors.text }]}>{item.vendorName}</Text>
      </View>
      

      {item.packagingPhotoURL ? (
        <TouchableOpacity onPress={() => setPreviewImageUrl(item.packagingPhotoURL || null)} activeOpacity={0.9}>
          <Image source={{ uri: item.packagingPhotoURL }} style={styles.cardPhoto} resizeMode="cover" />
          <View style={styles.photoHint}>
            <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
            <Text style={styles.photoHintText}>View photo</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.items, { borderTopColor: colors.border }]}>
        {(expandedProductJobIds.has(item.id) ? item.items : item.items.slice(0, 1)).map((line, index) => (
          <View key={`${item.id}-${line.materialId || line.materialName || 'item'}-${index}`} style={styles.itemRow}>
            <Ionicons name="cube-outline" size={15} color={colors.primaryText} />
            <Text style={[styles.itemName, { color: colors.text }]}>{line.materialName}</Text>
            <Text style={[styles.itemQuantity, { color: colors.textMuted }]}>{line.quantity} {line.unit}</Text>
          </View>
        ))}
        {item.items.length > 1 ? (
          <TouchableOpacity
            style={styles.readMoreButton}
            onPress={() => setExpandedProductJobIds((current) => {
              const next = new Set(current);
              if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
              return next;
            })}
          >
            <Text style={[styles.readMoreText, { color: colors.primaryText }]}>
              {expandedProductJobIds.has(item.id) ? 'Show less' : `Read more (${item.items.length - 1})`}
            </Text>
            <Ionicons name={expandedProductJobIds.has(item.id) ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primaryText} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primaryText} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={todaysJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={todaysJobs.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="No shipments today"
            subtitle="Use the plus button to submit a warehouse shipment."
          />
        }
      />

      <TouchableOpacity
        accessibilityLabel="Submit warehouse delivery"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setSheetVisible(true)}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Submit warehouse delivery</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>This sends the delivery to the site for acceptance, then inspection.</Text>
              </View>
              <TouchableOpacity onPress={closeSheet} disabled={saving} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[
                    styles.methodOption,
                    { borderColor: dispatchMethod === 'purchase_order' ? colors.primary : colors.border, backgroundColor: dispatchMethod === 'purchase_order' ? colors.primary : colors.inputBg },
                  ]}
                  onPress={() => {
                    setDispatchMethod('purchase_order');
                    setCsvFileName('');
                    setCsvPreviewError('');
                    setCsvPreviewOpen(true);
                    setCsvHeaders([]);
                    setLines([makeLine()]);
                  }}
                >
                  <Ionicons name="document-text-outline" size={18} color={dispatchMethod === 'purchase_order' ? '#FFFFFF' : colors.primaryText} />
                  <Text style={[styles.methodText, { color: dispatchMethod === 'purchase_order' ? '#FFFFFF' : colors.text }]}>Warehouse order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.methodOption,
                    { borderColor: dispatchMethod === 'file_upload' ? colors.primary : colors.border, backgroundColor: dispatchMethod === 'file_upload' ? colors.primary : colors.inputBg },
                  ]}
                  onPress={() => {
                    setDispatchMethod('file_upload');
                    setPackagingPhoto(null);
                    setCsvPreviewError('');
                    setCsvPreviewOpen(true);
                    setCsvHeaders([]);
                    setLines([]);
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={dispatchMethod === 'file_upload' ? '#FFFFFF' : colors.primaryText} />
                  <Text style={[styles.methodText, { color: dispatchMethod === 'file_upload' ? '#FFFFFF' : colors.text }]}>CSV or Excel upload</Text>
                </TouchableOpacity>
              </View>

              <Select
                nativeModal
                label="Warehouse delivery order"
                value={purchaseOrderId}
                options={warehousePurchaseOrders
                  .map((order) => ({
                    id: order.id,
                    name: order.poNumber || `${order.materialNumber || order.materialId} / ${order.vendorNumber || order.vendorId}`,
                    subtitle: `${order.materialNumber || order.materialId || 'Material'} • ${order.materialName || 'Unnamed material'} • ${order.vendorName || 'Vendor'}`,
                  }))}
                onSelect={selectPurchaseOrder}
                icon="document-text-outline"
                required
                placeholder="Select a warehouse-material order"
              />

              {dispatchMethod === 'file_upload' ? (
                <TouchableOpacity style={[styles.csvButton, { borderColor: colors.border, backgroundColor: colors.inputBg }]} onPress={selectSpreadsheet}>
                  <Ionicons name="cloud-upload-outline" size={22} color={colors.primaryText} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.csvTitle, { color: colors.text }]}>{csvFileName || 'Upload CSV or Excel file'}</Text>
                    <Text style={[styles.csvSubtitle, { color: colors.textMuted }]}>{REQUIRED_CSV_COLUMNS.join(', ')}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {dispatchMethod === 'file_upload' && csvFileName ? (
                <View style={[styles.csvPreview, { borderColor: csvPreviewError ? '#DC2626' : colors.border }]}>
                  <TouchableOpacity style={styles.csvPreviewToggle} onPress={() => setCsvPreviewOpen((open) => !open)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.csvPreviewTitle, { color: csvPreviewError ? '#DC2626' : colors.text }]}>
                        {csvPreviewError || `${lines.length} item${lines.length === 1 ? '' : 's'} ready for confirmation`}
                      </Text>
                      <Text style={[styles.csvPreviewMeta, { color: colors.textMuted }]}>Tap to {csvPreviewOpen ? 'collapse' : 'review'} parsed shipment lines</Text>
                    </View>
                    <Ionicons name={csvPreviewOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                  {csvPreviewOpen ? (
                    <ScrollView style={styles.csvPreviewList} nestedScrollEnabled>
                      {lines.map((line, index) => (
                        <View key={line.id} style={[styles.csvPreviewRow, index ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                          <Text style={[styles.csvPreviewName, { color: colors.text }]} numberOfLines={2}>{line.productName || 'No description'}</Text>
                          <Text style={[styles.csvPreviewMeta, { color: colors.textMuted }]} numberOfLines={1}>{line.source || 'Warehouse'} - {line.quantity || 0} {line.unit || 'tonnes'} - MRF {line.mrfNo || '-'}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}

              {dispatchMethod === 'purchase_order' ? (
                <>
                  <View style={styles.productsHeader}>
                    <View>
                      <Text style={[styles.productsTitle, { color: colors.text }]}>Products</Text>
                      <Text style={[styles.productsSubtitle, { color: colors.textMuted }]}>Add every product in this delivery.</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.addProductButton, { borderColor: colors.primary }]}
                      onPress={() => setLines((current) => [...current, makeLine()])}
                    >
                      <Ionicons name="add" size={17} color={colors.primaryText} />
                      <Text style={[styles.addProductText, { color: colors.primaryText }]}>Add product</Text>
                    </TouchableOpacity>
                  </View>

                  {lines.map((line) => (
                    <View key={line.id} style={[styles.lineCard, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                  {lines.length > 1 ? (
                    <TouchableOpacity
                      accessibilityLabel="Remove product"
                      style={styles.removeProductButton}
                      onPress={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}
                    >
                      <Ionicons name="close-circle" size={21} color="#DC2626" />
                    </TouchableOpacity>
                  ) : null}
                  <Input
                    label="Description"
                    value={line.productName}
                    onChangeText={(productName) => updateLine(line.id, { productName })}
                    icon="cube-outline"
                    required
                    placeholder="Type the product description"
                  />
                  <Input
                    label="Source"
                    value={line.source || ''}
                    onChangeText={(source) => updateLine(line.id, { source })}
                    icon="git-branch-outline"
                    placeholder="Material source"
                  />
                  <ResponsiveGrid style={styles.assignmentGrid}>
                    <View style={styles.assignmentField}>
                      <Input
                        label="Quantity"
                        value={line.quantity}
                        onChangeText={(quantity) => updateLine(line.id, { quantity })}
                        keyboardType="numeric"
                        icon="scale-outline"
                        required
                        placeholder="Quantity"
                      />
                    </View>
                    <View style={styles.assignmentField}>
                      <Select
                        nativeModal
                        label="Unit"
                        value={line.unit}
                        options={UNIT_OPTIONS}
                        onSelect={(unit) => updateLine(line.id, { unit })}
                        icon="resize-outline"
                        required
                        placeholder="Select unit"
                      />
                    </View>
                  </ResponsiveGrid>
                  <Input
                    label="MRF No."
                    value={line.mrfNo || ''}
                    onChangeText={(mrfNo) => updateLine(line.id, { mrfNo })}
                    icon="receipt-outline"
                    placeholder="MRF number"
                  />
                  <Input
                    label="Additional Notes"
                    value={line.additionalNotes || ''}
                    onChangeText={(additionalNotes) => updateLine(line.id, { additionalNotes })}
                    icon="document-text-outline"
                    placeholder="Optional notes"
                  />
                    </View>
                  ))}

                  <View style={[styles.packagingSection, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                    <View style={styles.packagingHeader}>
                      <View style={styles.packagingTitleRow}>
                        <View style={[styles.packagingIcon, { backgroundColor: colors.surface }]}>
                          <Ionicons name="camera-outline" size={20} color={colors.primaryText} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.packagingTitle, { color: colors.text }]}>Dispatch photo</Text>
                          <Text style={[styles.packagingSubtitle, { color: colors.textMuted }]}>Attach a shipment image from camera or gallery.</Text>
                        </View>
                      </View>
                    </View>
                    {packagingPhoto ? (
                      <Image source={{ uri: packagingPhoto.uri }} style={styles.packagingLargePreview} resizeMode="cover" />
                    ) : (
                      <View style={[styles.packagingLargePreview, styles.photoPlaceholder, { backgroundColor: colors.surface }]}>
                        <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                        <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>No photo attached</Text>
                      </View>
                    )}
                    <View style={styles.packagingActions}>
                      <TouchableOpacity style={[styles.packagingButton, { borderColor: colors.border }]} onPress={capturePackagingPhoto}>
                        <Ionicons name="camera-outline" size={17} color={colors.primaryText} />
                        <Text style={[styles.packagingButtonText, { color: colors.primaryText }]}>Take a photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.packagingButton, { borderColor: colors.border }]} onPress={choosePackagingPhoto}>
                        <Ionicons name="images-outline" size={17} color={colors.primaryText} />
                        <Text style={[styles.packagingButtonText, { color: colors.primaryText }]}>Upload Image</Text>
                      </TouchableOpacity>
                      {packagingPhoto ? (
                        <TouchableOpacity style={[styles.packagingRemoveButton, { borderColor: '#DC2626' }]} onPress={() => setPackagingPhoto(null)}>
                          <Ionicons name="trash-outline" size={17} color="#DC2626" />
                          <Text style={[styles.packagingButtonText, { color: '#DC2626' }]}>Remove</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </>
              ) : null}

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: canSubmit && !saving ? colors.primary : colors.border }]}
                onPress={handleSubmit}
                disabled={!canSubmit || saving}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
                <Text style={styles.submitText}>{saving ? 'Submitting...' : 'Submit to Site Schedule'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(previewImageUrl)} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
        <View style={styles.imagePreviewBackdrop}>
          <TouchableOpacity style={styles.imagePreviewClose} onPress={() => setPreviewImageUrl(null)} accessibilityLabel="Close image preview">
            <Ionicons name="close" size={27} color="#FFFFFF" />
          </TouchableOpacity>
          {previewImageUrl ? <Image source={{ uri: previewImageUrl }} style={styles.fullScreenImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: Spacing.xs},
  list: { padding: Spacing.md, paddingBottom: 110 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg, paddingBottom: 110 },
  jobCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xs},
  jobHeader: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  jobId: { fontSize: 16, fontWeight: '800' },
  reference: { fontSize: 12, marginTop: Spacing.xs},
  status: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  grnButton: { minHeight: 34, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 5 },
  grnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xs},
  assignmentText: { fontSize: 13, fontWeight: '600', marginRight: Spacing.sm },
  items: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.xs, paddingTop: Spacing.sm, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemName: { flex: 1, fontSize: 13, fontWeight: '600' },
  itemQuantity: { fontSize: 12, fontWeight: '700' },
  readMoreButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: Spacing.xs, paddingVertical: 3 },
  readMoreText: { fontSize: 12, fontWeight: '800' },
  fab: { position: 'absolute', right: 22, bottom: 26, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 7, boxShadow: '0px 3px 5px rgba(0,0,0,0.25)' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { width: '100%', maxWidth: 960, alignSelf: 'center', maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg, paddingBottom: Spacing.sm },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetSubtitle: { fontSize: 12, lineHeight: 17, marginTop: Spacing.xs},
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { padding: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 42 },
  notice: { flexDirection: 'row', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.xs},
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  assignmentGrid: { flexDirection: 'row', gap: Spacing.sm },
  assignmentField: { flex: 1 },
  busyAssignmentText: { color: '#B45309', fontSize: 12, fontWeight: '700', marginTop: Spacing.xs, marginBottom: Spacing.xs},
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  methodOption: { flex: 1, flexBasis: '45%', minHeight: 46, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  methodText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  csvButton: { minHeight: 72, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  csvTitle: { fontSize: 14, fontWeight: '800' },
  csvSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  csvPreview: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.xs },
  csvPreviewToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  csvPreviewTitle: { fontSize: 12, fontWeight: '800' },
  csvPreviewList: { maxHeight: 280, marginTop: Spacing.xs },
  csvPreviewRow: { paddingVertical: 7 },
  csvPreviewName: { fontSize: 13, fontWeight: '800' },
  csvPreviewMeta: { fontSize: 11, marginTop: 2 },
  productsHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.xs, marginBottom: Spacing.xs},
  productsTitle: { fontSize: 17, fontWeight: '800' },
  productsSubtitle: { fontSize: 12, marginTop: Spacing.xs},
  addProductButton: { minHeight: 36, paddingHorizontal: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: 3 },
  addProductText: { fontSize: 12, fontWeight: '800' },
  lineCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.xs, position: 'relative' },
  removeProductButton: { position: 'absolute', top: 8, right: 8, zIndex: 1, padding: 2 },
  packagingSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  packagingHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  packagingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  packagingIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  packagingTitle: { fontSize: 15, fontWeight: '800' },
  packagingSubtitle: { fontSize: 12, lineHeight: 17, marginTop: Spacing.xs},
  photoStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.full },
  photoStatusText: { fontSize: 11, fontWeight: '800' },
  packagingLargePreview: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.md, overflow: 'hidden' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  photoPlaceholderText: { fontSize: 13, fontWeight: '600' },
  packagingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  packagingButton: { flex: 1, flexBasis: '45%', minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md },
  packagingRemoveButton: { minHeight: 46, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md },
  packagingButtonText: { fontSize: 13, fontWeight: '800' },
  packagingPhoto: { width: 76, height: 58, borderRadius: Radius.sm, backgroundColor: '#E2E8F0' },
  cardPhoto: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.md, marginTop: Spacing.xs, backgroundColor: '#E2E8F0' },
  photoHint: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(15,23,42,0.76)', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5 },
  photoHintText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  missingPhotoButton: { marginTop: Spacing.xs, minHeight: 40, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  missingPhotoText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  submitButton: { minHeight: 52, borderRadius: Radius.md, marginTop: Spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  imagePreviewBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.96)', alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
  imagePreviewClose: { position: 'absolute', top: 52, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  fullScreenImage: { width: '100%', height: '82%' },
});
