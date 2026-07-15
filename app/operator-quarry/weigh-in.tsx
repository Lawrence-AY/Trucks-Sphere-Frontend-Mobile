import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { updateDeliveryOrder } from '../../services/api';
import { useDeliveryOrders } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { useAuthStore } from '../../store/authStore';
import { formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function OperatorQuarryWeighInScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [activeJob, setActiveJob] = useState<any>(null);
  const [weightIn, setWeightIn] = useState('');
  const [saving, setSaving] = useState(false);

  const allDeliveries = useDeliveryOrders();
  const refresh = useRealTimeSyncStore((s) => s.refresh);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh('deliveryOrders');
    setRefreshing(false);
  }, [refresh]);

  // Scope to operator's assigned quarry
  const operatorQuarryId = (user as any)?.quarryId || '';

  // Jobs that haven't been weighed in yet and aren't cancelled/completed
  const deliveries = useMemo(() => {
    let filtered = allDeliveries.filter((d: any) => !d.weighInWeight && !['delivered', 'completed', 'loaded', 'cancelled'].includes(d.status));
    if (operatorQuarryId) {
      filtered = filtered.filter((d: any) => !d.quarryId || d.quarryId === operatorQuarryId);
    }
    return filtered;
  }, [allDeliveries, operatorQuarryId]);

  // Build sets of trucks/drivers already on an active job
  const busyDriverIds = new Set<string>();
  const busyPlateNumbers = new Set<string>();
  allDeliveries.forEach((d: any) => {
    if (['loaded', 'at_quarry', 'in_transit', 'quarry_in', 'quarry_out', 'dispatched'].includes(d.status)) {
      if (d.driverId) busyDriverIds.add(d.driverId);
      if (d.plateNumber) busyPlateNumbers.add(d.plateNumber.toLowerCase());
    }
  });

  const isGrayedOut = (item: any): boolean => {
    const driverBusy = item.driverId && busyDriverIds.has(item.driverId);
    const truckBusy = item.plateNumber && busyPlateNumbers.has(item.plateNumber.toLowerCase());
    return driverBusy || truckBusy;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter((d) => !q || [d.jobId, d.driverName, d.plateNumber].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [deliveries, search]);

  const openWeighInForm = (job: any) => {
    if (isGrayedOut(job)) {
      Alert.alert('Unavailable', 'This truck or driver is currently assigned to another active job.');
      return;
    }
    setActiveJob(job); setWeightIn('');
  };
  const closeWeighInForm = () => { setActiveJob(null); setWeightIn(''); setSaving(false); };

  const handleSaveDraft = async () => {
    const numericWeight = parseFloat(weightIn);
    if (isNaN(numericWeight) || numericWeight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight value.');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await updateDeliveryOrder(activeJob.id, {
        weighInWeight: numericWeight,
        weighInAt: now,
        weighInLocation: activeJob.quarryName ? `${activeJob.quarryName} Gate` : 'Quarry Gate',
        weighInByUid: user?.uid || '',
        weighInByName: user?.displayName || user?.name || 'Quarry Operator',
        status: 'at_quarry',
        updatedAt: now,
      });
      closeWeighInForm();
      // Refresh immediately so weigh-out screen has updated data
      await refresh('deliveryOrders');
      router.navigate('/operator-quarry/weigh-out' as any);
    } catch (error: any) {
      Alert.alert('Save Failed', error?.message || 'Could not save weigh-in data.');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Weigh-In Form View ─── */
  if (activeJob) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.jobCardHeader}>
            <Text style={[styles.jobCardTitle, { color: colors.text }]}>{activeJob.jobId}</Text>
          </View>
          <DetailRow icon="document-outline" value={`PO: ${activeJob.poNumber || 'N/A'}`} />
          <DetailRow icon="person-outline" value={`${activeJob.driverName || 'Unassigned'} · ${activeJob.plateNumber || 'N/A'}`} />
          <DetailRow icon="cube-outline" value={`${activeJob.materialName || 'Material'}`} />
          <DetailRow icon="business-outline" value={`Vendor: ${activeJob.vendorName || 'N/A'}`} />
          <DetailRow icon="location-outline" value={`${activeJob.quarryName || 'Quarry'} → ${activeJob.siteName || 'Site'}`} />
          <Text style={[styles.jobTimestamp, { color: colors.textTertiary }]}>Created: {formatEAT(activeJob.createdAt)}</Text>
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: '#2563EB15' }]}>
              <Ionicons name="download-outline" size={22} color="#2563EB" />
            </View>
            <Text style={[styles.inputTitle, { color: colors.text }]}>Weigh-In</Text>
          </View>
          <Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter the empty weight (tare) of the truck before loading.</Text>
          <View style={[styles.weightInputWrap, { borderColor: '#2563EB', backgroundColor: colors.inputBg }]}>
            <TextInput style={[styles.weightInput, { color: colors.text }]} placeholder="0.0" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" value={weightIn} onChangeText={setWeightIn} autoFocus />
            <Text style={[styles.weightSuffix, { color: colors.textMuted }]}>Tonnes</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#2563EB' }]} onPress={handleSaveDraft} disabled={saving || !weightIn}>
          {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="save-outline" size={20} color="#FFFFFF" />}
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save to Draft'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={closeWeighInForm} disabled={saving}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /* ─── List View ─── */
  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
      <SectionTitle title={`${filtered.length} to weigh in`} />
      {allDeliveries.length === 0 ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const grayed = isGrayedOut(item);
          return (
            <DataCard
              key={item.id}
              onPress={() => openWeighInForm(item)}
              style={grayed ? { opacity: 0.45, backgroundColor: '#F1F5F9' } : undefined}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: grayed ? colors.textTertiary : colors.text }}>{item.jobId}</Text>
                {grayed && (
                  <View style={[styles.grayedBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B33' }]}>
                    <Ionicons name="lock-closed" size={10} color="#D97706" />
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#D97706' }}>IN USE</Text>
                  </View>
                )}
              </View>
              <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
              <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'}`} />
              {!grayed && (
                <View style={[styles.tapHint, { backgroundColor: `${colors.primary}08` }]}>
                  <Ionicons name="hand-left-outline" size={12} color={colors.primary} />
                  <Text style={[styles.tapHintText, { color: colors.primary }]}>Tap to weigh in</Text>
                </View>
              )}
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="download-outline" title="No weigh-ins pending" subtitle="All trucks have been weighed in." />
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
  jobTimestamp: { fontSize: 12, marginTop: Spacing.sm },
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  inputIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputTitle: { fontSize: 18, fontWeight: '700' },
  inputSub: { fontSize: 13, marginBottom: Spacing.md },
  weightInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 64, flexDirection: 'row', alignItems: 'center' },
  weightInput: { flex: 1, fontSize: 28, fontWeight: '800' },
  weightSuffix: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm, minHeight: 50, marginTop: Spacing.sm },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm },
  cancelText: { fontSize: 14, fontWeight: '600' },
  tapHint: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginTop: Spacing.sm },
  tapHintText: { fontSize: 11, fontWeight: '700' },
  grayedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
});