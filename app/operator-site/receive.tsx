import { isWarehouseJob } from '../../utils/warehouse';
import { normalizeJobStatus } from '../../utils/jobStatus';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Gap, Radius, Spacing } from '../../constants/theme';
import { fetchQuarries, updateDeliveryOrder } from '../../services/api';
import { useAuthStore } from '@/store/authStore';
import { useDeliveryOrders } from '@/store/realtimeData';
import { useRealTimeSyncStore } from '@/store/realTimeSyncStore';
import { formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function OperatorSiteReceiveScreen() {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const { user } = useAuthStore();
  const allDeliveries = useDeliveryOrders();
  const refresh = useRealTimeSyncStore((s) => s.refresh);
  const optimisticUpdate = useRealTimeSyncStore((s) => s.optimisticUpdate);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [activeJob, setActiveJob] = useState<any>(null);
  const [weightIn, setWeightIn] = useState('');
  const [weightOut, setWeightOut] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [quarries, setQuarries] = useState<any[]>([]);

  const operatorUid = user?.uid || '';
  const operatorSiteId = (user as any)?.siteId || '';

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh('deliveryOrders');
    setRefreshing(false);
  }, [refresh]);

  // Load quarries once
  useEffect(() => {
    fetchQuarries().then((data) => setQuarries(data || [])).catch(() => {});
  }, []);

  // Filter deliveries from the realtime store
  const deliveries = useMemo(() => {
    let filteredData = allDeliveries.filter((d: any) =>
      !isWarehouseJob(d) && ['QUARRY_WEIGHED_OUT', 'DISPATCHED', 'IN_TRANSIT'].includes(normalizeJobStatus(d.status))
    );
    // Apply data isolation for operator-site role
    if (operatorSiteId) {
      filteredData = filteredData.filter((d: any) => !d.siteId || d.siteId === operatorSiteId);
    }
    if (operatorUid) {
      filteredData = filteredData.filter((d: any) =>
        d.createdByUid === operatorUid ||
        d.siteOperatorUid === operatorUid ||
        d.siteWeighInByUid === operatorUid ||
        d.siteWeighOutByUid === operatorUid ||
        d.receivedByUid === operatorUid
      );
    }
    return filteredData;
  }, [allDeliveries, operatorSiteId, operatorUid]);

  // Mark loading as complete once we have any deliveries data
  useEffect(() => {
    if (allDeliveries.length > 0) setLoading(false);
  }, [allDeliveries]);

  // Resolve quarry name from quarries collection
  const resolveQuarryName = (job: any): string => {
    if (job.quarryId && quarries.length) {
      const match = quarries.find((q: any) => q.id === job.quarryId);
      if (match) return match.name || job.quarryName || '—';
    }
    return job.quarryName || '—';
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter((d) => !q || [d.jobId, d.driverName, d.plateNumber, d.materialName].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [deliveries, search]);

  const openReceiveForm = (job: any) => {
    setActiveJob(job);
    setWeightIn(job.siteWeighInWeight ? String(job.siteWeighInWeight) : '');
    setWeightOut(job.siteWeighOutWeight ? String(job.siteWeighOutWeight) : '');
    setLotNumber(job.storageLot || job.lotNumber || job.destinationLot || '');
  };

  const closeReceiveForm = () => {
    setActiveJob(null);
    setWeightIn('');
    setWeightOut('');
    setLotNumber('');
    setSaving(false);
  };

  const doSiteWeighIn = async (numericWeight: number) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updatePayload = {
        siteWeighInWeight: numericWeight,
        siteWeighInAt: now,
        siteWeighInByUid: user?.uid || '',
        status: 'site_in',
        storageLot: lotNumber || undefined,
        materialSource: activeJob.materialSource || undefined,
        updatedAt: now,
      };
      const merged = { ...activeJob, ...updatePayload };
      optimisticUpdate('deliveryOrders', merged);
      const updated = await updateDeliveryOrder(activeJob.id, updatePayload);
      const persisted = { ...merged, ...updated };
      // The server calculates and returns the signed site-arrival variance.
      // Apply it immediately so the site workflow shows the current flag.
      optimisticUpdate('deliveryOrders', persisted);
      setActiveJob(persisted);
      Alert.alert('Saved', 'Site arrival weight recorded.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not save weigh-in.');
    } finally {
      setSaving(false);
    }
  };

  const handleSiteWeighIn = async () => {
    const numericWeight = parseFloat(weightIn);
    if (isNaN(numericWeight) || numericWeight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid arrival weight.');
      return;
    }

    // ─── Variance Check: compare quarry weighOut weight vs site weighIn ───
    // If the weight difference between quarry weighOut and site weighIn is more than 5 tonnes, flag it
    const quarryWeighOut = activeJob?.weighOutWeight || 0;
    if (quarryWeighOut > 0) {
      const weightDiff = Math.abs(quarryWeighOut - numericWeight);
      if (weightDiff > 5.0) {
        Alert.alert(
          '⚠️ Weight Variance Alert',
          `The Site Arrival Weight (${numericWeight.toFixed(1)}T) differs by ${weightDiff.toFixed(1)}T from the Quarry Weigh Out (${quarryWeighOut.toFixed(1)}T).\n\nThis exceeds the 5.0 tonne tolerance. Please verify before proceeding.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Proceed Anyway', onPress: () => doSiteWeighIn(numericWeight) },
          ],
        );
        return;
      }
    }

    doSiteWeighIn(numericWeight);
  };

  const handleSiteWeighOut = async () => {
    if (!activeJob?.materialInspection?.mrfNumber) {
      Alert.alert('Inspection required', 'A Material Inspection & Receipt Form must be completed before site weigh-out.');
      return;
    }
    const numericWeight = parseFloat(weightOut);
    if (isNaN(numericWeight) || numericWeight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid offload weight.');
      return;
    }
    const siteInWeight = activeJob?.siteWeighInWeight || 0;
    if (numericWeight >= siteInWeight) {
      Alert.alert('Invalid Weight', 'Offload weight must be less than arrival weight.');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const siteNet = siteInWeight - numericWeight;
      const updated = await updateDeliveryOrder(activeJob.id, {
        siteWeighOutWeight: numericWeight,
        siteWeighOutAt: now,
        siteWeighOutByUid: user?.uid || '',
        siteNetWeight: siteNet,
        quantityDelivered: siteNet,
        receivedByUid: user?.uid || '',
        status: 'delivered',
        updatedAt: now,
      });
      // Optimistically update the shared cache so the job moves to history / disappears from receive
      const mergedOut = {
        ...activeJob,
        siteWeighOutWeight: numericWeight,
        siteWeighOutAt: now,
        siteWeighOutByUid: user?.uid || '',
        siteNetWeight: siteNet,
        quantityDelivered: siteNet,
        receivedByUid: user?.uid || '',
        status: 'delivered',
        updatedAt: now,
      };
      optimisticUpdate('deliveryOrders', { ...mergedOut, ...updated });
      closeReceiveForm();
      Alert.alert('Completed', `Site processing complete.\n\nArrival: ${siteInWeight.toFixed(1)}T · Offload: ${numericWeight.toFixed(1)}T · Net: ${siteNet.toFixed(1)}T`, [
        { text: 'OK' },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not save weigh-out.');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Receive Form View ─── */
  if (activeJob) {
    const hasSiteWeighIn = activeJob.siteWeighInWeight != null;
    const siteWeighInVal = activeJob.siteWeighInWeight || 0;
    const wOutNumeric = parseFloat(weightOut);

    return (
      <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {/* Job Info Card */}
        <View style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.jobCardHeader}>
            <Text style={[styles.jobCardTitle, { color: colors.text }]}>{activeJob.jobId}</Text>
          </View>
          <DetailRow icon="document-outline" value={`PO: ${activeJob.poNumber || 'N/A'}`} />
          <DetailRow icon="person-outline" value={`${activeJob.driverName || 'Unassigned'} · ${activeJob.plateNumber || 'N/A'}`} />
          <DetailRow icon="cube-outline" value={`${activeJob.materialName || 'Material'}`} />
          <DetailRow icon="business-outline" value={`Vendor: ${activeJob.vendorName || 'N/A'}`} />
          <DetailRow icon="location-outline" value={`Origin: ${activeJob.isWarehouseDelivery || activeJob.deliveryOrigin === 'warehouse' ? 'Warehouse' : activeJob.materialSource || activeJob.weighOutGeoLocation?.city || activeJob.weighOutGeoLocation?.town || activeJob.weighOutGeoLocation?.district || activeJob.weighOutGeoLocation?.name || activeJob.weighOutLocation || resolveQuarryName(activeJob)} → Dest: ${activeJob.siteName || '—'}`} />
          {/* Lot Number Input */}
          <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.inputHeader}>
              <View style={[styles.inputIcon, { backgroundColor: `${colors.warning}15` }]}>
                <Ionicons name="pricetag-outline" size={22} color={colors.warningText} />
              </View>
              <Text style={[styles.inputTitle, { color: colors.text }]}>Storage Lot Number</Text>
            </View>
            <Text style={[styles.inputSub, { color: colors.textMuted }]}>
              Assign a lot/storage location for this delivery.
            </Text>
            <View style={[styles.lotInputWrap, { borderColor: colors.warningBorder, backgroundColor: colors.inputBg }]}>
              <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
                style={[styles.weightInput, { color: colors.text }]}
                placeholder="e.g. LOT-A12"
                placeholderTextColor={colors.textTertiary}
                value={lotNumber}
                onChangeText={setLotNumber}
              />
            </View>
          </View>
          {activeJob.netWeight != null && (
            <DetailRow icon="scale-outline" value={`Quarry Net: ${Number(activeJob.netWeight).toFixed(1)} tonnes`} />
          )}
          {(activeJob.driverPhotoURL || activeJob.weighOutPhotoURL) ? (
            <View style={[styles.photoSection, { marginTop: Spacing.xs}]}>
              {activeJob.driverPhotoURL ? (
                <View style={{ marginBottom: Spacing.xs}}>
                  <View style={styles.dispatchPhotoHeader}>
                    <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.dispatchPhotoLabel, { color: colors.textMuted }]}>Driver Photo (Weigh-Out)</Text>
                  </View>
                  <Image
                    source={{ uri: activeJob.driverPhotoURL }}
                    style={[styles.dispatchPhoto, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                </View>
              ) : null}
              {activeJob.weighOutPhotoURL ? (
                <View>
                  <View style={styles.dispatchPhotoHeader}>
                    <Ionicons name="camera-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.dispatchPhotoLabel, { color: colors.textMuted }]}>Weigh-Out Photo</Text>
                  </View>
                  <Image
                    source={{ uri: activeJob.weighOutPhotoURL }}
                    style={[styles.dispatchPhoto, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Step 1: Site Weigh-In (Arrival) */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="download-outline" size={22} color={colors.success} />
            </View>
            <Text style={[styles.inputTitle, { color: colors.text }]}>Site Arrival Weight</Text>
            {hasSiteWeighIn && (
              <View style={[styles.badge, { backgroundColor: `${colors.success}15` }]}>
                <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.success }}>Recorded</Text>
              </View>
            )}
          </View>
          <Text style={[styles.inputSub, { color: colors.textMuted }]}>
            Enter the gross weight of the truck upon arrival at site.
          </Text>
          <View style={[styles.weightInputWrap, { borderColor: colors.successBorder, backgroundColor: colors.inputBg }]}>
            <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
              style={[styles.weightInput, { color: colors.text }]}
              placeholder="0.0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={weightIn}
              onChangeText={(value) => {
                const filtered = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                setWeightIn(filtered);
              }}
              editable={!hasSiteWeighIn}
            />
            <Text style={[styles.weightSuffix, { color: colors.textMuted }]}>Tonnes</Text>
          </View>
          {!hasSiteWeighIn && (
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.success }]}
              onPress={handleSiteWeighIn}
              disabled={saving || !weightIn}
            >
              {saving ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Ionicons name="save-outline" size={18} color={colors.onPrimary} />}
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Record Arrival Weight'}</Text>
            </TouchableOpacity>
          )}
          {hasSiteWeighIn && (
            <View style={[styles.recordedValue, { backgroundColor: `${colors.success}08`, borderColor: `${colors.successBorder}33` }]}>
              <Text style={[styles.recordedLabel, { color: colors.textMuted }]}>ARRIVAL WEIGHT</Text>
              <Text style={[styles.recordedWeight, { color: colors.success }]}>{siteWeighInVal.toFixed(1)} Tonnes</Text>
            </View>
          )}
        </View>

        {/* Step 2: Site Weigh-Out (Offload) - Only enabled after weigh-in */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: hasSiteWeighIn ? 1 : 0.5 }]}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: `${colors.danger}15` }]}>
              <Ionicons name="arrow-up-outline" size={22} color={colors.danger} />
            </View>
            <Text style={[styles.inputTitle, { color: colors.text }]}>Site Offload Weight</Text>
          </View>
          <Text style={[styles.inputSub, { color: colors.textMuted }]}>
            Enter the empty weight after offloading material.
          </Text>
          <View style={[styles.weightInputWrap, { borderColor: colors.dangerBorder, backgroundColor: colors.inputBg }]}>
            <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
              style={[styles.weightInput, { color: colors.text }]}
              placeholder="0.0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={weightOut}
              onChangeText={(value) => {
                const filtered = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                setWeightOut(filtered);
              }}
              editable={hasSiteWeighIn}
            />
            <Text style={[styles.weightSuffix, { color: colors.textMuted }]}>Tonnes</Text>
          </View>
          {wOutNumeric && hasSiteWeighIn && wOutNumeric < siteWeighInVal && (
            <View style={[styles.netPreview, { backgroundColor: `${colors.danger}08`, borderColor: `${colors.dangerBorder}33` }]}>
              <Text style={[styles.netLabel, { color: colors.textMuted }]}>SITE NET WEIGHT</Text>
              <Text style={[styles.netValue, { color: colors.danger }]}>{(siteWeighInVal - wOutNumeric).toFixed(1)} Tonnes</Text>
              <Text style={[styles.netCalc, { color: colors.textTertiary }]}>
                {siteWeighInVal.toFixed(1)}T (Arrival) − {wOutNumeric.toFixed(1)}T (Offload)
              </Text>
            </View>
          )}
          {hasSiteWeighIn && (
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.danger }]}
              onPress={handleSiteWeighOut}
              disabled={saving || !weightOut || parseFloat(weightOut) >= siteWeighInVal}
            >
              {saving ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} />}
              <Text style={styles.saveBtnText}>{saving ? 'Completing...' : 'Complete Delivery'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => { setLotNumber(''); setWeightIn(''); setWeightOut(''); setSearch(''); (closeReceiveForm)(); }} disabled={saving}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ─── List View ─── */
  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
      <SearchField title="Receive" icon="download-outline" value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
      <SectionTitle title={`${filtered.length} to receive`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => openReceiveForm(item)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'}`} />
            <View style={[styles.tapHint, { backgroundColor: `${colors.primary}08` }]}>
              <Ionicons name="hand-left-outline" size={12} color={colors.primaryText} />
              <Text style={[styles.tapHintText, { color: colors.primaryText }]}>Tap to receive</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="checkmark-circle-outline" title="All caught up" subtitle="No pending deliveries to receive." />
      )}
    </PageShell>
  );
}

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: { flex: 1 },
  formContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  jobCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.xs},
  jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs},
  jobCardTitle: { fontSize: 18, fontWeight: '800' },
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.xs},
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: Gap, marginBottom: Spacing.xs},
  inputIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  inputSub: { fontSize: 13, marginBottom: Spacing.xs},
  weightInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 64, flexDirection: 'row', alignItems: 'center' },
  lotInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 52, flexDirection: 'row', alignItems: 'center' },
  weightInput: { flex: 1, fontSize: 28, fontWeight: '800' },
  weightSuffix: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Gap, minHeight: 50, marginTop: Spacing.xs},
  saveBtnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.xs},
  cancelText: { fontSize: 14, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Gap, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  recordedValue: { marginTop: Spacing.xs, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
  recordedLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  recordedWeight: { fontSize: 28, fontWeight: '900', marginTop: Spacing.xs},
  netPreview: { marginTop: Spacing.xs, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
  netLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  netValue: { fontSize: 28, fontWeight: '900', marginTop: Spacing.xs},
  netCalc: { fontSize: 12, marginTop: Spacing.xs},
  tapHint: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: Gap, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginTop: Spacing.xs},
  tapHintText: { fontSize: 11, fontWeight: '700' },
  // Dispatch photo section (driver/weigh-out photos from quarry)
  photoSection: { gap: Gap},
  dispatchPhotoHeader: { flexDirection: 'row', alignItems: 'center', gap: Gap},
  dispatchPhotoLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dispatchPhoto: { width: '100%', height: 200, borderRadius: Radius.md, borderWidth: 1, backgroundColor: colors.surface },
});
