import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { updateDeliveryOrder } from '../../services/api';
import { useDeliveryOrders } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { formatEAT } from '../../utils/helpers';
import { uploadDriverPhotoWeighOut } from '../../services/uploadService';
import { getCurrentLocation, reverseGeocode, getLocationFromIP } from '../../services/geolocation';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function OperatorQuarryWeighOutScreen() {
  const colors = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [activeJob, setActiveJob] = useState<any>(null);
  const [weightOut, setWeightOut] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // ─── Driver Photo State ───
  const [driverPhotoUri, setDriverPhotoUri] = useState<string | null>(null);
  const [driverPhotoUploading, setDriverPhotoUploading] = useState(false);
  const [driverPhotoURL, setDriverPhotoURL] = useState<string | null>(null);

  // ─── Location State ───
  const [geoLocation, setGeoLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const allDeliveries = useDeliveryOrders();
  const refresh = useRealTimeSyncStore((s) => s.refresh);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh('deliveryOrders');
    setRefreshing(false);
  }, [refresh]);

  // Jobs that have been weighed in but not weighed out
  const deliveries = useMemo(() =>
    allDeliveries.filter((d: any) => d.weighInWeight && !d.weighOutWeight && !['delivered', 'completed', 'loaded', 'cancelled'].includes(d.status)),
    [allDeliveries]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter((d) => !q || [d.jobId, d.driverName, d.plateNumber].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [deliveries, search]);

  const openWeighOutForm = async (job: any) => {
    setActiveJob(job);
    setWeightOut('');
    setDriverPhotoUri(null);
    setDriverPhotoURL(job.driverPhotoURL || null);
    setGeoLocation(null);
    await captureLocation();
  };

  const closeWeighOutForm = () => {
    setActiveJob(null);
    setWeightOut('');
    setSubmitting(false);
    setDriverPhotoUri(null);
    setDriverPhotoURL(null);
    setGeoLocation(null);
  };

  const captureLocation = async () => {
    setLocationLoading(true);
    try {
      const loc = await getCurrentLocation();
      const address = await reverseGeocode(loc.latitude, loc.longitude);
      setGeoLocation({ ...loc, address });
    } catch {
      try {
        const fallback = await getLocationFromIP();
        setGeoLocation({
          latitude: fallback.latitude,
          longitude: fallback.longitude,
          address: fallback.address,
        });
      } catch {
        Alert.alert(
          'Location Unavailable',
          'Could not determine your location. Please enable location services or check your internet connection.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLocationLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const fileUri = result.assets[0].uri;
      await uploadDriverPhoto(fileUri, activeJob?.jobId);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to capture photo.');
    }
  };

  const uploadDriverPhoto = async (fileUri: string, jobId: string) => {
    if (!jobId) {
      Alert.alert('Upload Error', 'No active job selected. Please go back and select a job.');
      return;
    }
    setDriverPhotoUri(fileUri);
    setDriverPhotoUploading(true);
    try {
      const result = await uploadDriverPhotoWeighOut(jobId, fileUri);
      if (result.success && result.photoURL) {
        setDriverPhotoURL(result.photoURL);
        setDriverPhotoUri(null);
      } else {
        Alert.alert('Upload Warning', 'The server accepted the upload but did not return a photo URL. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message || 'Could not upload driver photo.');
      setDriverPhotoUri(null);
    } finally {
      setDriverPhotoUploading(false);
    }
  };

  const handleSubmitPress = () => {
    const numericWeightOut = parseFloat(weightOut);
    if (isNaN(numericWeightOut) || numericWeightOut <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weigh-out value.');
      return;
    }
    if (numericWeightOut <= (activeJob?.weighInWeight || 0)) {
      Alert.alert('Invalid Weight', 'Loaded weight must be higher than empty weight.');
      return;
    }
    if (!driverPhotoURL) {
      Alert.alert('Driver Photo Required', 'Please capture the driver\'s photo before submitting.');
      return;
    }
    if (!geoLocation) {
      Alert.alert('Location Required', 'Please wait for location to be captured or enable location services.');
      return;
    }
    setConfirmVisible(true);
  };

  const handleConfirmSubmit = async () => {
    const numericWeightOut = parseFloat(weightOut);
    const weighIn = activeJob?.weighInWeight || 0;
    const netWeight = numericWeightOut - weighIn;
    setConfirmVisible(false);
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const updatePayload: any = {
        weighOutWeight: numericWeightOut,
        netWeight,
        weighOutAt: now,
        weighOutLocation: geoLocation?.address || 'Weigh-Out Location',
        status: 'loaded',
        updatedAt: now,
      };
      if (driverPhotoURL) {
        updatePayload.driverPhotoURL = driverPhotoURL;
      }
      if (geoLocation) {
        updatePayload.weighOutGeoLocation = {
          latitude: geoLocation.latitude,
          longitude: geoLocation.longitude,
          address: geoLocation.address,
        };
      }
      await updateDeliveryOrder(activeJob.id, updatePayload);
      closeWeighOutForm();
      Alert.alert('Completed', `Weigh-Out submitted.\n\nLoaded: ${numericWeightOut.toFixed(1)}T · Empty: ${weighIn.toFixed(1)}T · Net: ${netWeight.toFixed(1)}T`, [
        { text: 'OK' },
      ]);
    } catch (error: any) {
      Alert.alert('Submission Failed', error?.message || 'Could not submit weigh-out data.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Weigh-Out Form View ─── */
  if (activeJob) {
    const wIn = activeJob.weighInWeight || 0;
    const wOut = parseFloat(weightOut);
    const net = !isNaN(wOut) && wOut > 0 && wOut > wIn ? wOut - wIn : null;

    return (
      <>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.jobCardHeader}>
              <Text style={[styles.jobCardTitle, { color: colors.text }]}>{activeJob.jobId}</Text>
            </View>
            <DetailRow icon="document-outline" value={`PO: ${activeJob.poNumber || 'N/A'}`} />
            <DetailRow icon="person-outline" value={`${activeJob.driverName || 'Unassigned'} · ${activeJob.plateNumber || 'N/A'}`} />
            <DetailRow icon="cube-outline" value={`${activeJob.materialName || 'Material'}`} />
            <DetailRow icon="business-outline" value={`Vendor: ${activeJob.vendorName || 'N/A'}`} />
            <DetailRow icon="location-outline" value={`Origin: ${geoLocation?.address || activeJob.quarryName || 'Quarry'}`} />
            {geoLocation && (
              <>
                <DetailRow icon="pin-outline" value={`${geoLocation.latitude.toFixed(6)}, ${geoLocation.longitude.toFixed(6)}`} />
              </>
            )}
            <DetailRow icon="flag-outline" value={`Dest: ${activeJob.siteName || '—'}`} />
            <View style={styles.divider} />
            <View style={styles.draftWeightRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.draftLabel, { color: colors.textMuted }]}>Empty Weight (Tare)</Text>
                <Text style={[styles.draftValue, { color: '#2563EB' }]}>{wIn.toFixed(1)} Tonnes</Text>
              </View>
              <View style={[styles.draftBadge, { backgroundColor: '#2563EB15' }]}>
                <Ionicons name="checkmark-circle" size={14} color="#2563EB" />
                <Text style={[styles.draftBadgeText, { color: '#2563EB' }]}>Recorded</Text>
              </View>
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="person-circle-outline" size={22} color="#F59E0B" />
              </View>
              <Text style={[styles.sectionTitleStyle, { color: colors.text }]}>Driver Photo</Text>
              {driverPhotoURL ? (
                <View style={[styles.photoStatusBadge, { backgroundColor: '#10B98115' }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={[styles.photoStatusText, { color: '#10B981' }]}>Captured</Text>
                </View>
              ) : (
                <View style={[styles.photoStatusBadge, { backgroundColor: '#EF444415' }]}>
                  <Ionicons name="alert-circle" size={14} color="#EF4444" />
                  <Text style={[styles.photoStatusText, { color: '#EF4444' }]}>Required</Text>
                </View>
              )}
            </View>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              Capture a photo of the driver at the weighbridge.
            </Text>
            {(driverPhotoURL || driverPhotoUri) ? (
              <View style={styles.photoPreviewWrap}>
                <Image
                  source={{ uri: driverPhotoUri || driverPhotoURL || '' }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
                {driverPhotoUploading && (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.photoOverlayText}>Uploading...</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.photoPreviewWrap, styles.photoPlaceholder]}>
                <Ionicons name="camera-outline" size={48} color="#94A3B8" />
                <Text style={styles.photoPlaceholderText}>No photo captured</Text>
              </View>
            )}
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[
                  styles.photoBtnFull,
                  {
                    backgroundColor: driverPhotoURL ? '#10B98115' : colors.inputBg,
                    borderColor: driverPhotoURL ? '#10B98133' : colors.border,
                  },
                ]}
                onPress={handleTakePhoto}
                disabled={driverPhotoUploading}
              >
                <Ionicons name="camera-outline" size={20} color={driverPhotoURL ? '#10B981' : colors.primary} />
                <Text style={[styles.photoBtnText, { color: driverPhotoURL ? '#10B981' : colors.primary }]}>
                  {driverPhotoURL ? 'Retake Photo' : 'Take Photo'}
                </Text>
              </TouchableOpacity>
              {driverPhotoURL && (
                <TouchableOpacity
                  style={[styles.photoBtn, { backgroundColor: '#EF444415', borderColor: '#EF444433' }]}
                  onPress={() => { setDriverPhotoURL(null); setDriverPhotoUri(null); }}
                  disabled={driverPhotoUploading}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={[styles.photoBtnText, { color: '#EF4444' }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="navigate-outline" size={22} color="#10B981" />
              </View>
              <Text style={[styles.sectionTitleStyle, { color: colors.text }]}>Location</Text>
              {locationLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : geoLocation ? (
                <View style={[styles.photoStatusBadge, { backgroundColor: '#10B98115' }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={[styles.photoStatusText, { color: '#10B981' }]}>Captured</Text>
                </View>
              ) : (
                <View style={[styles.photoStatusBadge, { backgroundColor: '#EF444415' }]}>
                  <Ionicons name="alert-circle" size={14} color="#EF4444" />
                  <Text style={[styles.photoStatusText, { color: '#EF4444' }]}>Required</Text>
                </View>
              )}
            </View>
            {geoLocation ? (
              <View style={[styles.locationBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={2}>
                    {geoLocation.address}
                  </Text>
                </View>
                <View style={styles.locationCoords}>
                  <Text style={[styles.coordText, { color: colors.textTertiary }]}>
                    Lat: {geoLocation.latitude.toFixed(6)} · Lng: {geoLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            ) : locationLoading ? (
              <View style={[styles.locationBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={styles.locationRow}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                  <Text style={[styles.locationText, { color: colors.textMuted }]}>Acquiring location...</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.locationBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={styles.locationRow}>
                  <Ionicons name="warning-outline" size={16} color="#EF4444" />
                  <Text style={[styles.locationText, { color: '#EF4444' }]}>Location unavailable. Please enable location services.</Text>
                </View>
                <TouchableOpacity
                  style={[styles.retryLocationBtn, { borderColor: colors.primary }]}
                  onPress={captureLocation}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                  <Text style={[styles.retryLocationText, { color: colors.primary }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.inputHeader}>
              <View style={[styles.inputIcon, { backgroundColor: '#7C3AED15' }]}>
                <Ionicons name="arrow-up-outline" size={22} color="#7C3AED" />
              </View>
              <Text style={[styles.inputTitle, { color: colors.text }]}>Weigh-Out</Text>
            </View>
            <Text style={[styles.inputSub, { color: colors.textMuted }]}>
              Enter the gross weight of the loaded truck.
            </Text>
            <View style={[styles.weightInputWrap, { borderColor: '#7C3AED', backgroundColor: colors.inputBg }]}>
              <TextInput
                style={[styles.weightInput, { color: colors.text }]}
                placeholder="0.0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                value={weightOut}
                onChangeText={setWeightOut}
                autoFocus
              />
              <Text style={[styles.weightSuffix, { color: colors.textMuted }]}>Tonnes</Text>
            </View>
            {net !== null && net > 0 && (
              <View style={[styles.netPreview, { backgroundColor: '#7C3AED08', borderColor: '#7C3AED33' }]}>
                <Text style={[styles.netLabel, { color: colors.textMuted }]}>NET WEIGHT</Text>
                <Text style={[styles.netValue, { color: '#7C3AED' }]}>{net.toFixed(1)} Tonnes</Text>
                <Text style={[styles.netCalc, { color: colors.textTertiary }]}>
                  {wOut.toFixed(1)}T (Loaded) − {wIn.toFixed(1)}T (Empty)
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor:
                  weightOut && parseFloat(weightOut) > 0 && parseFloat(weightOut) > wIn && driverPhotoURL && geoLocation
                    ? '#7C3AED'
                    : colors.border,
              },
            ]}
            onPress={handleSubmitPress}
            disabled={submitting || !weightOut || parseFloat(weightOut) <= 0 || parseFloat(weightOut) <= wIn || !driverPhotoURL || !geoLocation}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Weigh-Out'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={closeWeighOutForm}
            disabled={submitting}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>

        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.confirmDialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.confirmIcon, { backgroundColor: '#7C3AED15' }]}>
                <Ionicons name="shield-checkmark-outline" size={32} color="#7C3AED" />
              </View>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>Confirm Submission</Text>
              <Text style={[styles.confirmSub, { color: colors.textMuted }]}>
                Please verify all details before finalizing this record. Job will move to history after submission.
              </Text>
              <View style={[styles.confirmSummary, { backgroundColor: colors.inputBg }]}>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Job ID</Text>
                  <Text style={[styles.confirmValue, { color: colors.text }]}>{activeJob.jobId}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Driver</Text>
                  <Text style={[styles.confirmValue, { color: colors.text }]}>{activeJob.driverName || 'N/A'}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Truck</Text>
                  <Text style={[styles.confirmValue, { color: colors.text }]}>{activeJob.plateNumber || 'N/A'}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Material</Text>
                  <Text style={[styles.confirmValue, { color: colors.text }]}>{activeJob.materialName || 'N/A'}</Text>
                </View>
                {geoLocation && (
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Location</Text>
                    <Text style={[styles.confirmValue, { color: colors.text }]} numberOfLines={1}>{geoLocation.address}</Text>
                  </View>
                )}
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Empty (Tare)</Text>
                  <Text style={[styles.confirmValue, { color: '#2563EB', fontWeight: '800' }]}>{wIn.toFixed(1)} T</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Loaded (Gross)</Text>
                  <Text style={[styles.confirmValue, { color: '#7C3AED', fontWeight: '800' }]}>{parseFloat(weightOut).toFixed(1)} T</Text>
                </View>
                <View style={[styles.confirmDivider, { marginTop: 6 }]} />
                <View style={styles.confirmRow}>
                  <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Net Weight</Text>
                  <Text style={[styles.confirmValue, { color: colors.success, fontWeight: '900', fontSize: 18 }]}>
                    {(parseFloat(weightOut) - wIn).toFixed(1)} T
                  </Text>
                </View>
                {driverPhotoURL && (
                  <>
                    <View style={styles.confirmDivider} />
                    <View style={styles.confirmRow}>
                      <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Driver Photo</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Text style={[styles.confirmValue, { color: '#10B981' }]}>Attached</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={[styles.confirmCancelBtn, { borderColor: colors.border }]} onPress={() => setConfirmVisible(false)}>
                  <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Go Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmProceedBtn, { backgroundColor: '#7C3AED' }]} onPress={handleConfirmSubmit}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmProceedText}>Confirm & Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  /* ─── List View ─── */
  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
      <SectionTitle title={`${filtered.length} to weigh out`} />
      {allDeliveries.length === 0 ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const wInVal = item.weighInWeight || 0;
          return (
            <DataCard key={item.id} onPress={() => openWeighOutForm(item)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
              </View>
              <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
              <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'}`} />
              <View style={styles.listWeighInBadge}>
                <Ionicons name="download-outline" size={12} color="#2563EB" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>Empty Weight: {wInVal.toFixed(1)} T</Text>
              </View>
              <View style={[styles.tapHint, { backgroundColor: `${colors.primary}08` }]}>
                <Ionicons name="hand-left-outline" size={12} color={colors.primary} />
                <Text style={[styles.tapHintText, { color: colors.primary }]}>Tap to weigh out</Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="arrow-up-outline" title="No weigh-outs pending" subtitle="All weighed-in trucks have been weighed out." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  jobCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  jobCardTitle: { fontSize: 18, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: Spacing.sm },
  draftWeightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  draftLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  draftValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  draftBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  draftBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  sectionTitleStyle: { fontSize: 16, fontWeight: '700', flex: 1 },
  sectionSub: { fontSize: 13, marginBottom: Spacing.md },
  photoStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  photoStatusText: { fontSize: 11, fontWeight: '700' },
  photoPreviewWrap: { width: '100%', height: 220, borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.md, backgroundColor: '#F1F5F9' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginTop: 8 },
  photoOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  photoOverlayText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 8 },
  photoActions: { flexDirection: 'row', gap: Spacing.sm },
  photoBtnFull: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: 1 },
  photoBtnText: { fontSize: 13, fontWeight: '700' },
  locationBox: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  locationText: { fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  locationCoords: { marginTop: Spacing.sm, paddingLeft: 28 },
  coordText: { fontSize: 11, fontFamily: 'monospace' },
  retryLocationBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, marginTop: Spacing.sm },
  retryLocationText: { fontSize: 12, fontWeight: '700' },
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  inputIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputTitle: { fontSize: 18, fontWeight: '700' },
  inputSub: { fontSize: 13, marginBottom: Spacing.md },
  weightInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 64, flexDirection: 'row', alignItems: 'center' },
  weightInput: { flex: 1, fontSize: 28, fontWeight: '800' },
  weightSuffix: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
  netPreview: { marginTop: Spacing.md, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
  netLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  netValue: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  netCalc: { fontSize: 12, marginTop: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm, minHeight: 50, marginTop: Spacing.sm },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm },
  cancelText: { fontSize: 14, fontWeight: '600' },
  listWeighInBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: '#2563EB12', marginTop: Spacing.sm },
  tapHint: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginTop: 6 },
  tapHintText: { fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  confirmDialog: { width: '100%', maxWidth: 380, borderRadius: 18, borderWidth: 1, padding: Spacing.xl },
  confirmIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.md },
  confirmTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: Spacing.sm },
  confirmSub: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: Spacing.lg },
  confirmSummary: { borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, gap: 6 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  confirmLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  confirmValue: { fontSize: 12, fontWeight: '700', maxWidth: '75%' },
  confirmDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  confirmActions: { flexDirection: 'row', gap: Spacing.md },
  confirmCancelBtn: { flex: 1, minHeight: 48, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontSize: 14, fontWeight: '700' },
  confirmProceedBtn: { flex: 1, minHeight: 48, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  confirmProceedText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});