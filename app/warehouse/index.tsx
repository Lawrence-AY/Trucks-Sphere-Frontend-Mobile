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
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { createWarehouseJob, fetchDeliveryOrders, fetchDrivers, fetchMaterials, fetchPurchaseOrders, fetchVehicles, fetchVendors, fetchWarehouseJobs } from '../../services/api';
import { uploadWarehousePackagingPhoto, type UploadFile } from '../../services/uploadService';
import { Driver, Material, PurchaseOrder, Vehicle, Vendor, WarehouseJob } from '../../store/types';
import { useAuthStore } from '../../store/authStore';
import { isActiveJob } from '../../utils/jobStatus';
import { normalizeRole } from '../../utils/access';

type DraftLine = { id: string; productName: string; quantity: string; unit: string };
type PackagingPhoto = UploadFile & { displayName: string };
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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([makeLine()]);
  const [packagingPhoto, setPackagingPhoto] = useState<PackagingPhoto | null>(null);
  const [uploadingPhotoJobId, setUploadingPhotoJobId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [expandedProductJobIds, setExpandedProductJobIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    const [warehouseJobs, deliveryData, purchaseOrderData, materialData, vendorData, driverData, vehicleData] = await Promise.all([
      fetchWarehouseJobs(),
      fetchDeliveryOrders(),
      fetchPurchaseOrders(),
      fetchMaterials(),
      fetchVendors(),
      fetchDrivers(),
      fetchVehicles(),
    ]);
    setJobs(warehouseJobs as WarehouseJob[]);
    setDeliveries(deliveryData);
    setPurchaseOrders(purchaseOrderData as PurchaseOrder[]);
    setMaterials(materialData as Material[]);
    setVendors(vendorData as Vendor[]);
    setDrivers(driverData as Driver[]);
    setVehicles(vehicleData as Vehicle[]);
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
    return visibleJobs.filter((job) => job.submittedAt && new Date(job.submittedAt) >= startOfToday);
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
      order.status !== 'cancelled' && (order.isWarehouseMaterial || warehouseMaterialIds.has(String(order.materialId || '').trim().toLowerCase())),
    ),
    [purchaseOrders, warehouseMaterialIds],
  );
  const availableDrivers = useMemo(
    () => drivers.filter((driver) => driver.vendorId === vendorId && driver.availability !== false),
    [drivers, vendorId],
  );
  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.vendorId === vendorId && vehicle.status === 'active'),
    [vehicles, vendorId],
  );
  const selectedDriverBusyJob = useMemo(
    () => driverId ? deliveries.find((delivery) => delivery.driverId === driverId && isActiveJob(delivery.status)) : null,
    [deliveries, driverId],
  );
  const selectedVehicleBusyJob = useMemo(
    () => vehicleId ? deliveries.find((delivery) =>
      (delivery.vehicleId === vehicleId || delivery.plateNumber === availableVehicles.find((vehicle) => vehicle.id === vehicleId)?.registrationNumber || delivery.plateNumber === availableVehicles.find((vehicle) => vehicle.id === vehicleId)?.plateNumber) &&
      isActiveJob(delivery.status),
    ) : null,
    [availableVehicles, deliveries, vehicleId],
  );
  const assignmentBusy = Boolean(selectedDriverBusyJob || selectedVehicleBusyJob);

  const resetSheet = () => {
    setPurchaseOrderId('');
    setVendorId('');
    setDriverId('');
    setVehicleId('');
    setLines([makeLine()]);
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
    setDriverId('');
    setVehicleId('');
  };

  const updateLine = (id: string, changes: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
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
      displayName: asset.fileName || 'Selected rceipt photo',
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
      Alert.alert('Packaging photo attached', `${job.jobId} is now available for Site acceptance and weighing.`);
    } catch (error: any) {
      Alert.alert('Could not attach photo', error?.message || 'Please try again.');
    } finally {
      setUploadingPhotoJobId(null);
    }
  };

  const canSubmit = Boolean(
    purchaseOrderId && vendorId && driverId && vehicleId && !assignmentBusy && packagingPhoto &&
    lines.length > 0 &&
    lines.every((line) => line.productName.trim() && line.unit.trim() && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0),
  );

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (assignmentBusy) {
        Alert.alert('Assignment unavailable', selectedDriverBusyJob && selectedVehicleBusyJob
          ? `The selected driver and truck are already on active trips (${selectedDriverBusyJob.jobId} and ${selectedVehicleBusyJob.jobId}).`
          : selectedDriverBusyJob
            ? `The selected driver is already on active trip ${selectedDriverBusyJob.jobId}.`
            : `The selected truck is already on active trip ${selectedVehicleBusyJob?.jobId}.`);
        return;
      }
      Alert.alert('Complete the submission', 'Choose the purchase order, driver, truck, packaging photo, and product quantities.');
      return;
    }

    setSaving(true);
    try {
      const job = await createWarehouseJob({
        purchaseOrderId,
        vendorId,
        driverId,
        vehicleId,
        items: lines.map((line) => ({ productName: line.productName.trim(), quantity: Number(line.quantity), unit: line.unit.trim() })),
        createdByUid: user?.uid || '',
        createdByName: user?.displayName || user?.email || '',
      }) as WarehouseJob;
      let submittedJob = job;
      let packagingUploadFailed = false;
      if (packagingPhoto) {
        try {
          const uploaded = await uploadWarehousePackagingPhoto(job.id, packagingPhoto);
          submittedJob = {
            ...job,
            packagingPhotoURL: uploaded.photoURL,
            packagingPhotoFileName: packagingPhoto.name,
          };
        } catch {
          // The delivery order is already submitted to the site. Avoid a
          // second submission that would create another truck movement.
          packagingUploadFailed = true;
        }
      }
      setJobs((current) => [submittedJob, ...current]);
      setSheetVisible(false);
      resetSheet();
      Alert.alert(
        'Warehouse delivery submitted',
        packagingUploadFailed
          ? `${job.jobId}\nThe truck was submitted to the Site Schedule, but the packaging photo was not saved.`
          : `${job.jobId}\nThe truck is now on the Site Schedule for acceptance and weighing.`,
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
      <View style={styles.jobHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
          <Text style={[styles.reference, { color: colors.textMuted }]}>Purchase order: {purchaseOrderReference(item)}</Text>
        </View>
       
      </View>

      <View style={styles.assignmentRow}>
        <Ionicons name="business-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.assignmentText, { color: colors.text }]}>{item.vendorName}</Text>
      </View>
      <View style={styles.assignmentRow}>
        <Ionicons name="person-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.assignmentText, { color: colors.text }]}>{item.driverName}</Text>
        <Ionicons name="car-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.assignmentText, { color: colors.text }]}>{item.plateNumber}</Text>
      </View>
      

      {item.packagingPhotoURL ? (
        <TouchableOpacity onPress={() => setPreviewImageUrl(item.packagingPhotoURL || null)} activeOpacity={0.9}>
          <Image source={{ uri: item.packagingPhotoURL }} style={styles.cardPhoto} resizeMode="cover" />
          <View style={styles.photoHint}>
            <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
            <Text style={styles.photoHintText}>View photo</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.missingPhotoButton, { borderColor: '#D97706', backgroundColor: '#FEF3C7' }]}
          disabled={uploadingPhotoJobId === item.id}
          onPress={() => attachMissingPackagingPhoto(item)}
        >
          {uploadingPhotoJobId === item.id ? <ActivityIndicator color="#B45309" /> : <Ionicons name="camera-outline" size={17} color="#B45309" />}
          <Text style={styles.missingPhotoText}>{uploadingPhotoJobId === item.id ? 'Attaching photo...' : 'Add required packaging photo'}</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.items, { borderTopColor: colors.border }]}>
        {(expandedProductJobIds.has(item.id) ? item.items : item.items.slice(0, 1)).map((line, index) => (
          <View key={`${item.id}-${line.materialId || line.materialName || 'item'}-${index}`} style={styles.itemRow}>
            <Ionicons name="cube-outline" size={15} color={colors.primary} />
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
            <Text style={[styles.readMoreText, { color: colors.primary }]}>
              {expandedProductJobIds.has(item.id) ? 'Show less' : `Read more (${item.items.length - 1})`}
            </Text>
            <Ionicons name={expandedProductJobIds.has(item.id) ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
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
                <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>This sends the assigned truck directly to the Site Schedule.</Text>
              </View>
              <TouchableOpacity onPress={closeSheet} disabled={saving} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <Select
                nativeModal
                label="Warehouse purchase order"
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

              <Select
                nativeModal
                label="Driver"
                value={driverId}
                options={availableDrivers.map((driver) => ({
                  id: driver.id,
                  name: driver.fullName,
                  subtitle: `${driver.driverId || 'Driver'} • ${deliveries.find((delivery) => delivery.driverId === driver.id && isActiveJob(delivery.status)) ? `On trip: ${deliveries.find((delivery) => delivery.driverId === driver.id && isActiveJob(delivery.status))?.jobId}` : driver.licenseNumber || driver.phone || 'No licence recorded'}`,
                  imageUrl: driver.photoURL,
                }))}
                onSelect={setDriverId}
                icon="person-outline"
                required
                placeholder={selectedVendor ? 'Select driver' : 'Select purchase order first'}
              />
              {selectedDriverBusyJob ? <Text style={styles.busyAssignmentText}>Driver is on active trip {selectedDriverBusyJob.jobId}</Text> : null}

              <Select
                nativeModal
                label="Truck"
                value={vehicleId}
                options={availableVehicles.map((vehicle) => ({ id: vehicle.id, name: vehicle.registrationNumber || vehicle.plateNumber || vehicle.id, subtitle: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() }))}
                onSelect={setVehicleId}
                icon="car-outline"
                required
                placeholder={selectedVendor ? 'Select truck' : 'Select purchase order first'}
              />
              {selectedVehicleBusyJob ? <Text style={styles.busyAssignmentText}>Truck is on active trip {selectedVehicleBusyJob.jobId}</Text> : null}

              <View style={styles.productsHeader}>
                <View>
                  <Text style={[styles.productsTitle, { color: colors.text }]}>Products</Text>
                  <Text style={[styles.productsSubtitle, { color: colors.textMuted }]}>Add every product being delivered in this truck.</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addProductButton, { borderColor: colors.primary }]}
                  onPress={() => setLines((current) => [...current, makeLine()])}
                >
                  <Ionicons name="add" size={17} color={colors.primary} />
                  <Text style={[styles.addProductText, { color: colors.primary }]}>Add product</Text>
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
                    label="Product name"
                    value={line.productName}
                    onChangeText={(productName) => updateLine(line.id, { productName })}
                    icon="cube-outline"
                    required
                    placeholder="Type the product name"
                  />
                  <View style={styles.assignmentGrid}>
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
                  </View>
                </View>
              ))}

              <View style={[styles.packagingSection, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={styles.packagingHeader}>
                  <View style={styles.packagingTitleRow}>
                    <View style={[styles.packagingIcon, { backgroundColor: `${colors.primary}15` }]}>
                      <Ionicons name="camera-outline" size={21} color={colors.primary} />
                    </View>
                    <Text style={[styles.packagingTitle, { color: colors.text }]}>Packaging photo</Text>
                  </View>
                  <View style={[styles.photoStatusBadge, { backgroundColor: packagingPhoto ? '#10B98115' : '#EF444415' }]}>
                    <Ionicons name={packagingPhoto ? 'checkmark-circle' : 'alert-circle'} size={14} color={packagingPhoto ? '#10B981' : '#EF4444'} />
                    <Text style={[styles.photoStatusText, { color: packagingPhoto ? '#10B981' : '#EF4444' }]}>{packagingPhoto ? 'Captured' : 'Required'}</Text>
                  </View>
                </View>
                <Text style={[styles.packagingSubtitle, { color: colors.textMuted }]}>Capture the product packaging before submitting the shipment.</Text>
                {packagingPhoto ? (
                  <Image source={{ uri: packagingPhoto.uri }} style={styles.packagingLargePreview} resizeMode="cover" />
                ) : (
                  <View style={[styles.packagingLargePreview, styles.photoPlaceholder, { backgroundColor: colors.inputBg }]}>
                    <Ionicons name="camera-outline" size={44} color={colors.textMuted} />
                    <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>No photo captured</Text>
                  </View>
                )}
                <View style={styles.packagingActions}>
                  <TouchableOpacity style={[styles.packagingButton, { backgroundColor: packagingPhoto ? '#10B98115' : colors.inputBg, borderColor: packagingPhoto ? '#10B98133' : colors.border }]} onPress={capturePackagingPhoto}>
                    <Ionicons name="camera-outline" size={20} color={packagingPhoto ? '#10B981' : colors.primary} />
                    <Text style={[styles.packagingButtonText, { color: packagingPhoto ? '#10B981' : colors.primary }]}>{packagingPhoto ? 'Retake photo' : 'Take photo'}</Text>
                  </TouchableOpacity>
                  {packagingPhoto ? (
                    <TouchableOpacity style={[styles.packagingRemoveButton, { backgroundColor: '#EF444415', borderColor: '#EF444433' }]} onPress={() => setPackagingPhoto(null)}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      <Text style={[styles.packagingButtonText, { color: '#EF4444' }]}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

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
  assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xs},
  assignmentText: { fontSize: 13, fontWeight: '600', marginRight: Spacing.sm },
  items: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.xs, paddingTop: Spacing.sm, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemName: { flex: 1, fontSize: 13, fontWeight: '600' },
  itemQuantity: { fontSize: 12, fontWeight: '700' },
  readMoreButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: Spacing.xs, paddingVertical: 3 },
  readMoreText: { fontSize: 12, fontWeight: '800' },
  fab: { position: 'absolute', right: 22, bottom: 26, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
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
  productsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.xs, marginBottom: Spacing.xs},
  productsTitle: { fontSize: 17, fontWeight: '800' },
  productsSubtitle: { fontSize: 12, marginTop: Spacing.xs},
  addProductButton: { minHeight: 36, paddingHorizontal: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: 3 },
  addProductText: { fontSize: 12, fontWeight: '800' },
  lineCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.xs, position: 'relative' },
  removeProductButton: { position: 'absolute', top: 8, right: 8, zIndex: 1, padding: 2 },
  packagingSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  packagingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  packagingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  packagingIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  packagingTitle: { fontSize: 15, fontWeight: '800' },
  packagingSubtitle: { fontSize: 12, lineHeight: 17, marginTop: Spacing.xs},
  photoStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.full },
  photoStatusText: { fontSize: 11, fontWeight: '800' },
  packagingLargePreview: { width: '100%', height: 176, borderRadius: Radius.md, overflow: 'hidden' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  photoPlaceholderText: { fontSize: 13, fontWeight: '600' },
  packagingActions: { flexDirection: 'row', gap: Spacing.sm },
  packagingButton: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md },
  packagingRemoveButton: { minHeight: 46, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.md },
  packagingButtonText: { fontSize: 13, fontWeight: '800' },
  packagingPhoto: { width: 76, height: 58, borderRadius: Radius.sm, backgroundColor: '#E2E8F0' },
  cardPhoto: { width: '100%', height: 164, borderRadius: Radius.md, marginTop: Spacing.xs, backgroundColor: '#E2E8F0' },
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
