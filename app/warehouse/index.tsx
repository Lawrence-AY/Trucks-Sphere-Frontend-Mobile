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
import { createWarehouseJob, fetchDrivers, fetchSites, fetchVehicles, fetchVendors, fetchWarehouseJobs } from '../../services/api';
import { uploadWarehousePackagingPhoto, type UploadFile } from '../../services/uploadService';
import { Driver, Site, Vehicle, Vendor, WarehouseJob } from '../../store/types';
import { useAuthStore } from '../../store/authStore';

type DraftLine = { id: string; productName: string; quantity: string; unit: string };
type PackagingPhoto = UploadFile & { displayName: string };

function makeLine(): DraftLine {
  return { id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, productName: '', quantity: '', unit: 'tonnes' };
}

function displayVendor(vendor: Vendor) {
  return vendor.companyName || vendor.vendorId || vendor.id;
}

export default function WarehouseQueueScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const [jobs, setJobs] = useState<WarehouseJob[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pomatReference, setPomatReference] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([makeLine()]);
  const [packagingPhoto, setPackagingPhoto] = useState<PackagingPhoto | null>(null);
  const [uploadingPhotoJobId, setUploadingPhotoJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [warehouseJobs, vendorData, driverData, vehicleData, siteData] = await Promise.all([
      fetchWarehouseJobs(),
      fetchVendors(),
      fetchDrivers(),
      fetchVehicles(),
      fetchSites(),
    ]);
    setJobs(warehouseJobs as WarehouseJob[]);
    setVendors(vendorData as Vendor[]);
    setDrivers(driverData as Driver[]);
    setVehicles(vehicleData as Vehicle[]);
    setSites(siteData as Site[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedVendor = vendors.find((vendor) => vendor.id === vendorId);
  const availableDrivers = useMemo(
    () => drivers.filter((driver) => driver.vendorId === vendorId && driver.availability !== false),
    [drivers, vendorId],
  );
  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.vendorId === vendorId && vehicle.status === 'active'),
    [vehicles, vendorId],
  );

  const resetSheet = () => {
    setPomatReference('');
    setVendorId('');
    setDriverId('');
    setVehicleId('');
    setSiteId('');
    setLines([makeLine()]);
    setPackagingPhoto(null);
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetVisible(false);
    resetSheet();
  };

  const selectVendor = (id: string) => {
    setVendorId(id);
    setDriverId('');
    setVehicleId('');
  };

  const updateLine = (id: string, changes: Partial<DraftLine>) => {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
  };

  const capturePackagingPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to photograph the product packaging.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPackagingPhoto({
      uri: asset.uri,
      name: asset.fileName || `warehouse-packaging-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      displayName: asset.fileName || 'Captured packaging photo',
    });
  };

  const choosePackagingPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo library permission needed', 'Allow photo library access to select the packaging photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPackagingPhoto({
      uri: asset.uri,
      name: asset.fileName || `warehouse-packaging-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      displayName: asset.fileName || 'Selected packaging photo',
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
    pomatReference && vendorId && driverId && vehicleId && siteId && packagingPhoto &&
    lines.length > 0 &&
    lines.every((line) => line.productName.trim() && line.unit.trim() && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0),
  );

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Complete the submission', 'Enter the POMAT reference and product, then choose the vendor, driver, truck, site, packaging photo, and quantity.');
      return;
    }

    setSaving(true);
    try {
      const job = await createWarehouseJob({
        pomatReference,
        vendorId,
        driverId,
        vehicleId,
        siteId,
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
          <Text style={[styles.reference, { color: colors.textMuted }]}>Reference: {item.warehouseReference}</Text>
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
        <Image source={{ uri: item.packagingPhotoURL }} style={styles.packagingPhoto} resizeMode="cover" />
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
        {item.items.map((line) => (
          <View key={`${item.id}-${line.materialId}`} style={styles.itemRow}>
            <Ionicons name="cube-outline" size={15} color={colors.primary} />
            <Text style={[styles.itemName, { color: colors.text }]}>{line.materialName}</Text>
            <Text style={[styles.itemQuantity, { color: colors.textMuted }]}>{line.quantity} {line.unit}</Text>
          </View>
        ))}
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
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Warehouse Deliveries</Text>
       </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        contentContainerStyle={jobs.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="No warehouse deliveries"
            subtitle="Use the plus button to submit a warehouse truck to a site."
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
              <Input
                label="POMAT reference"
                value={pomatReference}
                onChangeText={(value) => setPomatReference(value.toUpperCase().replace(/\s/g, ''))}
                icon="bookmark-outline"
                required
                placeholder="POMAT077"
              />

              <Select
                nativeModal
                label="Vendor"
                value={vendorId}
                options={vendors.filter((vendor) => vendor.status !== 'inactive').map((vendor) => ({ id: vendor.id, name: displayVendor(vendor), subtitle: vendor.vendorId }))}
                onSelect={selectVendor}
                icon="business-outline"
                required
                placeholder="Select vendor"
              />

              <View style={styles.assignmentGrid}>
                <View style={styles.assignmentField}>
                  <Select
                    nativeModal
                    label="Driver"
                    value={driverId}
                    options={availableDrivers.map((driver) => ({ id: driver.id, name: driver.fullName, subtitle: driver.licenseNumber }))}
                    onSelect={setDriverId}
                    icon="person-outline"
                    required
                    placeholder={selectedVendor ? 'Select driver' : 'Select vendor first'}
                  />
                </View>
                <View style={styles.assignmentField}>
                  <Select
                    nativeModal
                    label="Truck"
                    value={vehicleId}
                    options={availableVehicles.map((vehicle) => ({ id: vehicle.id, name: vehicle.registrationNumber || vehicle.plateNumber || vehicle.id, subtitle: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() }))}
                    onSelect={setVehicleId}
                    icon="car-outline"
                    required
                    placeholder={selectedVendor ? 'Select truck' : 'Select vendor first'}
                  />
                </View>
              </View>

              <Select
                nativeModal
                label="Delivery site"
                value={siteId}
                options={sites.filter((site) => site.status !== 'inactive').map((site) => ({ id: site.id, name: site.name, subtitle: site.location?.address }))}
                onSelect={setSiteId}
                icon="location-outline"
                required
                placeholder="Select the receiving site"
              />

              <View style={styles.productsHeader}>
                <View>
                  <Text style={[styles.productsTitle, { color: colors.text }]}>Custom product</Text>
                  <Text style={[styles.productsSubtitle, { color: colors.textMuted }]}>Type the product being delivered in this truck.</Text>
                </View>
              </View>

              {lines.map((line) => (
                <View key={line.id} style={[styles.lineCard, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
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
                      <Input
                        label="Unit"
                        value={line.unit}
                        onChangeText={(unit) => updateLine(line.id, { unit })}
                        icon="resize-outline"
                        required
                        placeholder="Tonnes"
                      />
                    </View>
                  </View>
                </View>
              ))}

              <View style={[styles.packagingSection, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <View>
                  <Text style={[styles.packagingTitle, { color: colors.text }]}>Packaging photo</Text>
                  <Text style={[styles.packagingSubtitle, { color: colors.textMuted }]}>Required. Site personnel will see this before accepting the truck.</Text>
                </View>
                <View style={styles.packagingActions}>
                  <TouchableOpacity style={[styles.packagingButton, { borderColor: colors.primary }]} onPress={capturePackagingPhoto}>
                    <Ionicons name="camera-outline" size={17} color={colors.primary} />
                    <Text style={[styles.packagingButtonText, { color: colors.primary }]}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.packagingButton, { borderColor: colors.primary }]} onPress={choosePackagingPhoto}>
                    <Ionicons name="images-outline" size={17} color={colors.primary} />
                    <Text style={[styles.packagingButtonText, { color: colors.primary }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
                {packagingPhoto ? (
                  <View style={styles.packagingPreviewRow}>
                    <Image source={{ uri: packagingPhoto.uri }} style={styles.packagingPhoto} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.packagingFileName, { color: colors.text }]} numberOfLines={2}>{packagingPhoto.displayName}</Text>
                      <TouchableOpacity onPress={() => setPackagingPhoto(null)}>
                        <Text style={[styles.packagingRemove, { color: '#DC2626' }]}>Remove photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontSize: 25, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  list: { padding: Spacing.md, paddingBottom: 110 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg, paddingBottom: 110 },
  jobCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  jobHeader: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  jobId: { fontSize: 16, fontWeight: '800' },
  reference: { fontSize: 12, marginTop: 2 },
  status: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  assignmentText: { fontSize: 13, fontWeight: '600', marginRight: Spacing.sm },
  items: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.md, paddingTop: Spacing.sm, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemName: { flex: 1, fontSize: 13, fontWeight: '600' },
  itemQuantity: { fontSize: 12, fontWeight: '700' },
  fab: { position: 'absolute', right: 22, bottom: 26, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg, paddingBottom: Spacing.sm },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { padding: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 42 },
  notice: { flexDirection: 'row', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  assignmentGrid: { flexDirection: 'row', gap: Spacing.sm },
  assignmentField: { flex: 1 },
  productsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  productsTitle: { fontSize: 17, fontWeight: '800' },
  productsSubtitle: { fontSize: 12, marginTop: 2 },
  lineCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  packagingSection: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  packagingTitle: { fontSize: 15, fontWeight: '800' },
  packagingSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  packagingActions: { flexDirection: 'row', gap: Spacing.sm },
  packagingButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: Radius.md },
  packagingButtonText: { fontSize: 13, fontWeight: '800' },
  packagingPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  packagingPhoto: { width: 76, height: 58, borderRadius: Radius.sm, backgroundColor: '#E2E8F0' },
  packagingFileName: { fontSize: 12, fontWeight: '700' },
  packagingRemove: { fontSize: 12, fontWeight: '800', marginTop: 6 },
  missingPhotoButton: { marginTop: Spacing.sm, minHeight: 40, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  missingPhotoText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  submitButton: { minHeight: 52, borderRadius: Radius.md, marginTop: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
