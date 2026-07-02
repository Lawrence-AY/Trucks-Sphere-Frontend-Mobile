import { useEffect, useMemo, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders, updateDeliveryOrder } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

export default function OperatorQuarryWeighInScreen() {
  const colors = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [activeJob, setActiveJob] = useState<any>(null);
  const [weightIn, setWeightIn] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchDeliveryOrders()) || [];
      setDeliveries(data.filter((d: any) => !d.weighInWeight && !['delivered', 'completed', 'cancelled'].includes(d.status)));
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Auto-open job from route param (after job card creation)
  useEffect(() => {
    if (params.id && deliveries.length > 0) {
      const target = deliveries.find((d) => d.jobId === params.id);
      if (target) {
        setActiveJob(target);
        setWeightIn('');
      }
    }
  }, [params.id, deliveries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter((d) => !q || [d.jobId, d.driverName, d.plateNumber].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [deliveries, search]);

  const openWeighInForm = (job: any) => { setActiveJob(job); setWeightIn(''); };
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
      const updated = await updateDeliveryOrder(activeJob.id, {
        weighInWeight: numericWeight,
        weighInAt: now,
        weighInLocation: activeJob.quarryName ? `${activeJob.quarryName} Gate` : 'Quarry Gate',
        status: 'DRAFT_WEIGH_IN_COMPLETE',
        updatedAt: now,
      });
      setDeliveries((current) => current.map((item) => (item.id === activeJob.id ? updated : item)));
      Alert.alert('Saved', `Weigh-In of ${numericWeight.toFixed(1)} tonnes saved as draft. Job forwarded to Weigh-Out stage.`, [{ text: 'OK', onPress: () => { closeWeighInForm(); router.replace('/operator-quarry/dashboard' as any); } }]);
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
            <StatusPill status={activeJob.status} compact />
          </View>
          <DetailRow icon="document-outline" value={`PO: ${activeJob.poNumber || 'N/A'}`} />
          <DetailRow icon="person-outline" value={`${activeJob.driverName || 'Unassigned'} · ${activeJob.plateNumber || 'N/A'}`} />
          <DetailRow icon="cube-outline" value={`${activeJob.materialName || 'Material'} · ${activeJob.quantityOrdered || 0} tonnes`} />
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
          <Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter the weight of the empty truck (tare weight).</Text>
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
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
      <SectionTitle title={`${filtered.length} to weigh in`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => openWeighInForm(item)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
              <StatusPill status={item.status} compact />
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
            <View style={[styles.tapHint, { backgroundColor: `${colors.primary}08` }]}>
              <Ionicons name="hand-left-outline" size={12} color={colors.primary} />
              <Text style={[styles.tapHintText, { color: colors.primary }]}>Tap to weigh in</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
          </DataCard>
        ))
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
});