import { useEffect, useMemo, useState } from 'react';
import {
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
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders, fetchQuarries, updateDeliveryOrder } from '../../services/api';
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
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [activeJob, setActiveJob] = useState<any>(null);
  const [weightIn, setWeightIn] = useState('');
  const [weightOut, setWeightOut] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [quarries, setQuarries] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [data, quarriesData] = await Promise.all([
        fetchDeliveryOrders(),
        fetchQuarries(),
      ]);
      // Show jobs that have been dispatched from quarry (loaded/in_transit) and haven't been fully site-processed yet
      setDeliveries((data || []).filter((d: any) =>
        ['loaded', 'dispatched', 'in_transit', 'en_route'].includes(d.status)
      ));
      setQuarries(quarriesData || []);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
      const updated = await updateDeliveryOrder(activeJob.id, {
        siteWeighInWeight: numericWeight,
        siteWeighInAt: now,
        status: 'site_in',
        storageLot: lotNumber || undefined,
        materialSource: activeJob.materialSource || undefined,
        updatedAt: now,
      });
      setDeliveries((current) => current.map((item) => (item.id === activeJob.id ? updated : item)));
      setActiveJob(updated);
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
        siteNetWeight: siteNet,
        status: 'delivered',
        updatedAt: now,
      });
      setDeliveries((current) => current.filter((item) => item.id !== activeJob.id));
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
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
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
                          <DetailRow icon="location-outline" value={`Origin: ${activeJob.materialSource || activeJob.weighOutGeoLocation?.city || activeJob.weighOutGeoLocation?.town || activeJob.weighOutGeoLocation?.district || activeJob.weighOutGeoLocation?.name || activeJob.weighOutLocation || resolveQuarryName(activeJob)} → Dest: ${activeJob.siteName || '—'}`} />
          {/* Lot Number Input */}
          <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.inputHeader}>
              <View style={[styles.inputIcon, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="pricetag-outline" size={22} color="#F59E0B" />
              </View>
              <Text style={[styles.inputTitle, { color: colors.text }]}>Storage Lot Number</Text>
            </View>
            <Text style={[styles.inputSub, { color: colors.textMuted }]}>
              Assign a lot/storage location for this delivery.
            </Text>
            <View style={[styles.lotInputWrap, { borderColor: '#F59E0B', backgroundColor: colors.inputBg }]}>
              <TextInput
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
            <View style={[styles.photoSection, { marginTop: Spacing.md }]}>
              {activeJob.driverPhotoURL ? (
                <View style={{ marginBottom: Spacing.sm }}>
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
            <View style={[styles.inputIcon, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="download-outline" size={22} color="#10B981" />
            </View>
            <Text style={[styles.inputTitle, { color: colors.text }]}>Site Arrival Weight</Text>
            {hasSiteWeighIn && (
              <View style={[styles.badge, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>Recorded</Text>
              </View>
            )}
          </View>
          <Text style={[styles.inputSub, { color: colors.textMuted }]}>
            Enter the gross weight of the truck upon arrival at site.
          </Text>
          <View style={[styles.weightInputWrap, { borderColor: '#10B981', backgroundColor: colors.inputBg }]}>
            <TextInput
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
              style={[styles.saveBtn, { backgroundColor: '#10B981' }]}
              onPress={handleSiteWeighIn}
              disabled={saving || !weightIn}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="save-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Record Arrival Weight'}</Text>
            </TouchableOpacity>
          )}
          {hasSiteWeighIn && (
            <View style={[styles.recordedValue, { backgroundColor: '#10B98108', borderColor: '#10B98133' }]}>
              <Text style={[styles.recordedLabel, { color: colors.textMuted }]}>ARRIVAL WEIGHT</Text>
              <Text style={[styles.recordedWeight, { color: '#10B981' }]}>{siteWeighInVal.toFixed(1)} Tonnes</Text>
            </View>
          )}
        </View>

        {/* Step 2: Site Weigh-Out (Offload) - Only enabled after weigh-in */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: hasSiteWeighIn ? 1 : 0.5 }]}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: '#EF444415' }]}>
              <Ionicons name="arrow-up-outline" size={22} color="#EF4444" />
            </View>
            <Text style={[styles.inputTitle, { color: colors.text }]}>Site Offload Weight</Text>
          </View>
          <Text style={[styles.inputSub, { color: colors.textMuted }]}>
            Enter the empty weight after offloading material.
          </Text>
          <View style={[styles.weightInputWrap, { borderColor: '#EF4444', backgroundColor: colors.inputBg }]}>
            <TextInput
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
            <View style={[styles.netPreview, { backgroundColor: '#EF444408', borderColor: '#EF444433' }]}>
              <Text style={[styles.netLabel, { color: colors.textMuted }]}>SITE NET WEIGHT</Text>
              <Text style={[styles.netValue, { color: '#EF4444' }]}>{(siteWeighInVal - wOutNumeric).toFixed(1)} Tonnes</Text>
              <Text style={[styles.netCalc, { color: colors.textTertiary }]}>
                {siteWeighInVal.toFixed(1)}T (Arrival) − {wOutNumeric.toFixed(1)}T (Offload)
              </Text>
            </View>
          )}
          {hasSiteWeighIn && (
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#EF4444' }]}
              onPress={handleSiteWeighOut}
              disabled={saving || !weightOut || parseFloat(weightOut) >= siteWeighInVal}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />}
              <Text style={styles.saveBtnText}>{saving ? 'Completing...' : 'Complete Delivery'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={closeReceiveForm} disabled={saving}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  /* ─── List View ─── */
  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
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
              <Ionicons name="hand-left-outline" size={12} color={colors.primary} />
              <Text style={[styles.tapHintText, { color: colors.primary }]}>Tap to receive</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  formContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  jobCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  jobCardTitle: { fontSize: 18, fontWeight: '800' },
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  inputIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  inputSub: { fontSize: 13, marginBottom: Spacing.md },
  weightInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 64, flexDirection: 'row', alignItems: 'center' },
  lotInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 52, flexDirection: 'row', alignItems: 'center' },
  weightInput: { flex: 1, fontSize: 28, fontWeight: '800' },
  weightSuffix: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm, minHeight: 50, marginTop: Spacing.sm },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm },
  cancelText: { fontSize: 14, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  recordedValue: { marginTop: Spacing.md, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
  recordedLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  recordedWeight: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  netPreview: { marginTop: Spacing.md, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
  netLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  netValue: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  netCalc: { fontSize: 12, marginTop: 4 },
  tapHint: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginTop: Spacing.sm },
  tapHintText: { fontSize: 11, fontWeight: '700' },
  // Dispatch photo section (driver/weigh-out photos from quarry)
  photoSection: { gap: Spacing.xs },
  dispatchPhotoHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dispatchPhotoLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dispatchPhoto: { width: '100%', height: 200, borderRadius: Radius.md, borderWidth: 1, backgroundColor: '#F1F5F9' },
});
