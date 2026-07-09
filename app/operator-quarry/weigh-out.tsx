import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { router } from 'expo-router';
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
} from '../../components/EnterpriseUI';

export default function OperatorQuarryWeighOutScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [activeJob, setActiveJob] = useState<any>(null);
  const [weightOut, setWeightOut] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const loadData = async (silent?: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const data = (await fetchDeliveryOrders()) || [];
      // Show only jobs that have weigh-in but NOT weigh-out
      setDeliveries(data.filter((d: any) => d.weighInWeight && !d.weighOutWeight && !['delivered', 'completed', 'loaded', 'cancelled'].includes(d.status)));
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter((d) => !q || [d.jobId, d.driverName, d.plateNumber].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [deliveries, search]);

  const openWeighOutForm = (job: any) => { setActiveJob(job); setWeightOut(''); };
  const closeWeighOutForm = () => { setActiveJob(null); setWeightOut(''); setSubmitting(false); };

  const handleSubmitPress = () => {
    const numericWeightOut = parseFloat(weightOut);
    if (isNaN(numericWeightOut) || numericWeightOut <= 0) { Alert.alert('Invalid Weight', 'Please enter a valid weigh-out value.'); return; }
    // Weigh-Out (loaded) must be HIGHER than weigh-in (empty/tare)
    if (numericWeightOut <= (activeJob?.weighInWeight || 0)) { Alert.alert('Invalid Weight', 'Loaded weight must be higher than empty weight.'); return; }
    setConfirmVisible(true);
  };

  const handleConfirmSubmit = async () => {
    const numericWeightOut = parseFloat(weightOut);
    const weighIn = activeJob?.weighInWeight || 0;
    // Net = loaded - empty
    const netWeight = numericWeightOut - weighIn;
    setConfirmVisible(false);
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const updated = await updateDeliveryOrder(activeJob.id, {
        weighOutWeight: numericWeightOut,
        netWeight,
        weighOutAt: now,
        weighOutLocation: activeJob.quarryName ? `${activeJob.quarryName} Exit` : 'Quarry Exit',
        status: 'loaded',
        updatedAt: now,
      });
      setDeliveries((current) => current.map((item) => (item.id === activeJob.id ? updated : item)));
      closeWeighOutForm();
      Alert.alert('Completed', `Weigh-Out submitted.\n\nLoaded: ${numericWeightOut.toFixed(1)}T · Empty: ${weighIn.toFixed(1)}T · Net: ${netWeight.toFixed(1)}T`, [
        { text: 'OK', onPress: () => closeWeighOutForm() },
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
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
          <View style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.jobCardHeader}>
              <Text style={[styles.jobCardTitle, { color: colors.text }]}>{activeJob.jobId}</Text>
            </View>
            <DetailRow icon="document-outline" value={`PO: ${activeJob.poNumber || 'N/A'}`} />
            <DetailRow icon="person-outline" value={`${activeJob.driverName || 'Unassigned'} · ${activeJob.plateNumber || 'N/A'}`} />
            <DetailRow icon="cube-outline" value={`${activeJob.materialName || 'Material'}`} />
            <DetailRow icon="business-outline" value={`Vendor: ${activeJob.vendorName || 'N/A'}`} />
            <DetailRow icon="location-outline" value={`${activeJob.quarryName || 'Quarry'} → ${activeJob.siteName || 'Site'}`} />
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

          <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.inputHeader}>
              <View style={[styles.inputIcon, { backgroundColor: '#7C3AED15' }]}>
                <Ionicons name="arrow-up-outline" size={22} color="#7C3AED" />
              </View>
              <Text style={[styles.inputTitle, { color: colors.text }]}>Weigh-Out</Text>
            </View>
            <Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter the gross weight of the loaded truck (must be higher than empty weight).</Text>
            <View style={[styles.weightInputWrap, { borderColor: '#7C3AED', backgroundColor: colors.inputBg }]}>
              <TextInput style={[styles.weightInput, { color: colors.text }]} placeholder="0.0" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" value={weightOut} onChangeText={setWeightOut} autoFocus />
              <Text style={[styles.weightSuffix, { color: colors.textMuted }]}>Tonnes</Text>
            </View>

            {net !== null && net > 0 && (
              <View style={[styles.netPreview, { backgroundColor: '#7C3AED08', borderColor: '#7C3AED33' }]}>
                <Text style={[styles.netLabel, { color: colors.textMuted }]}>NET WEIGHT</Text>
                <Text style={[styles.netValue, { color: '#7C3AED' }]}>{net.toFixed(1)} Tonnes</Text>
                <Text style={[styles.netCalc, { color: colors.textTertiary }]}>{wOut.toFixed(1)}T (Loaded) − {wIn.toFixed(1)}T (Empty)</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: weightOut && parseFloat(weightOut) > 0 && parseFloat(weightOut) > wIn ? '#7C3AED' : colors.border }]}
            onPress={handleSubmitPress}
            disabled={submitting || !weightOut || parseFloat(weightOut) <= 0 || parseFloat(weightOut) <= wIn}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}
            <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Weigh-Out'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={closeWeighOutForm} disabled={submitting}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Confirmation Modal */}
        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.confirmDialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.confirmIcon, { backgroundColor: '#7C3AED15' }]}>
                <Ionicons name="shield-checkmark-outline" size={32} color="#7C3AED" />
              </View>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>Confirm Submission</Text>
              <Text style={[styles.confirmSub, { color: colors.textMuted }]}>Please verify all details before finalizing this record. Job will move to history after submission.</Text>
              <View style={[styles.confirmSummary, { backgroundColor: colors.inputBg }]}>
                <View style={styles.confirmRow}><Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Job ID</Text><Text style={[styles.confirmValue, { color: colors.text }]}>{activeJob.jobId}</Text></View>
                <View style={styles.confirmRow}><Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Driver</Text><Text style={[styles.confirmValue, { color: colors.text }]}>{activeJob.driverName || 'N/A'}</Text></View>
                <View style={styles.confirmRow}><Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Truck</Text><Text style={[styles.confirmValue, { color: colors.text }]}>{activeJob.plateNumber || 'N/A'}</Text></View>
                <View style={styles.confirmRow}><Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Material</Text><Text style={[styles.confirmValue, { color: colors.text }]}>{activeJob.materialName || 'N/A'}</Text></View>
                <View style={styles.confirmDivider} />
                <View style={styles.confirmRow}><Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Empty (Tare)</Text><Text style={[styles.confirmValue, { color: '#2563EB', fontWeight: '800' }]}>{wIn.toFixed(1)} T</Text></View>
                <View style={styles.confirmRow}><Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Loaded (Gross)</Text><Text style={[styles.confirmValue, { color: '#7C3AED', fontWeight: '800' }]}>{parseFloat(weightOut).toFixed(1)} T</Text></View>
                <View style={[styles.confirmDivider, { marginTop: 6 }]} />
                <View style={styles.confirmRow}><Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Net Weight</Text><Text style={[styles.confirmValue, { color: colors.success, fontWeight: '900', fontSize: 18 }]}>{(parseFloat(weightOut) - wIn).toFixed(1)} T</Text></View>
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
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
      <SectionTitle title={`${filtered.length} to weigh out`} />
      {loading ? (
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
  confirmValue: { fontSize: 14, fontWeight: '700' },
  confirmDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  confirmActions: { flexDirection: 'row', gap: Spacing.md },
  confirmCancelBtn: { flex: 1, minHeight: 48, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontSize: 14, fontWeight: '700' },
  confirmProceedBtn: { flex: 1, minHeight: 48, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  confirmProceedText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});