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
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders, createFuelRecord, fetchFuelRecords } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function FuelDispenseScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [activeJob, setActiveJob] = useState<any>(null);
  const [fuelAmount, setFuelAmount] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // FAB / Job Search Modal state
  const [jobSearchVisible, setJobSearchVisible] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');

  const loadData = async (silent?: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const [deliveryData, fuelData] = await Promise.all([
        fetchDeliveryOrders(),
        fetchFuelRecords(),
      ]);
      setAllDeliveries(deliveryData || []);
      setDeliveries((deliveryData || []).filter((d: any) => !['completed', 'delivered', 'cancelled'].includes(d.status)));
      setFuelRecords(fuelData || []);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); const t = setInterval(() => loadData(true), 5000); return () => clearInterval(t); }, []);

  // Track which job IDs have had fuel dispensed (any amount)
  const fueledJobIds = useMemo(() => {
    const ids = new Set<string>();
    fuelRecords.forEach((f) => { if (f.jobId) ids.add(f.jobId); });
    return ids;
  }, [fuelRecords]);

  const getJobFuelAmount = (jobId: string): number => {
    return fuelRecords.filter((f) => f.jobId === jobId).reduce((sum, f) => sum + (f.fuelAmount || 0), 0);
  };

  const getJobFuelRecordCount = (jobId: string): number => {
    return fuelRecords.filter((f) => f.jobId === jobId).length;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter(
      (d) => !q || [d.jobId, d.driverName, d.plateNumber, d.vendorName].some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [deliveries, search]);

  // FAB bottom sheet: show ALL jobs except those already fueled
  const jobSearchResults = useMemo(() => {
    const q = jobSearchQuery.trim().toLowerCase();
    const source = allDeliveries.filter((d) => !fueledJobIds.has(d.jobId || d.id));
    if (!q) return source;
    return source.filter(
      (d) => [d.jobId, d.driverName, d.plateNumber, d.vendorName, d.poNumber].some(
        (v) => String(v || '').toLowerCase().includes(q),
      ),
    );
  }, [allDeliveries, jobSearchQuery, fueledJobIds]);

  const openJobSearch = () => {
    setJobSearchQuery('');
    setJobSearchVisible(true);
  };
  const closeJobSearch = () => {
    setJobSearchVisible(false);
    setJobSearchQuery('');
  };

  const selectJobFromSearch = (job: any) => {
    closeJobSearch();
    setTimeout(() => {
      setActiveJob(job);
      setFuelAmount('');
    }, 300);
  };

  const openFuelForm = (job: any) => { setActiveJob(job); setFuelAmount(''); setPricePerLiter(''); };
  const closeFuelForm = () => { setActiveJob(null); setFuelAmount(''); setPricePerLiter(''); setSubmitting(false); };

  const handleSubmit = async () => {
    const amount = parseFloat(fuelAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid fuel amount.');
      return;
    }
    setSubmitting(true);
    try {
      const price = parseFloat(pricePerLiter) || 0;
      await createFuelRecord({
        jobId: activeJob.jobId,
        deliveryOrderId: activeJob.id,
        driverId: activeJob.driverId,
        driverName: activeJob.driverName || 'N/A',
        plateNumber: activeJob.plateNumber || 'N/A',
        vendorId: activeJob.vendorId,
        vendorName: activeJob.vendorName || 'N/A',
        materialName: activeJob.materialName || 'N/A',
        fuelAmount: amount,
        pricePerLiter: price,
        totalCost: price > 0 ? amount * price : 0,
        unit: 'Litres',
        dispensedBy: 'Fuel Operator',
        dispensedAt: new Date().toISOString(),
      });
      Alert.alert('Fuel Dispensed', `${amount.toFixed(1)} litres recorded for ${activeJob.jobId}.`, [
        { text: 'OK', onPress: () => { closeFuelForm(); loadData(); } }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to record fuel');
    } finally {
      setSubmitting(false);
    }
  };

  if (activeJob) {
    const jobFuelAmount = getJobFuelAmount(activeJob.jobId || activeJob.id);
    const jobFuelRecords = getJobFuelRecordCount(activeJob.jobId || activeJob.id);

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.jobCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.jobCardTitle, { color: colors.text }]}>{activeJob.jobId}</Text>
              <Text style={[styles.jobPo, { color: colors.textMuted }]}>{activeJob.poNumber || 'No PO'}</Text>
            </View>
          </View>
          <DetailRow icon="person-outline" value={`${activeJob.driverName || 'N/A'} · ${activeJob.plateNumber || 'N/A'}`} />
          <DetailRow icon="business-outline" value={`Vendor: ${activeJob.vendorName || 'N/A'}`} />
          <DetailRow icon="cube-outline" value={`${activeJob.materialName || 'Material'} · ${activeJob.quantityOrdered || 0} tonnes`} />
          {jobFuelAmount > 0 && (
            <View style={[styles.existingFuel, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' }]}>
              <Ionicons name="water" size={16} color="#F59E0B" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>
                {jobFuelAmount.toFixed(1)} L already dispensed ({jobFuelRecords} record{jobFuelRecords !== 1 ? 's' : ''})
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: '#F59E0B15' }]}>
              <Ionicons name="water-outline" size={22} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputTitle, { color: colors.text }]}>Fuel Amount</Text>
              <Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter fuel amount in litres.</Text>
            </View>
          </View>
          <View style={[styles.fuelInputWrap, { borderColor: '#F59E0B', backgroundColor: colors.inputBg }]}>
            <TextInput
              style={[styles.fuelInput, { color: colors.text }]}
              placeholder="0.0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={fuelAmount}
              onChangeText={setFuelAmount}
              autoFocus
            />
            <Text style={[styles.fuelSuffix, { color: colors.textMuted }]}>Litres</Text>
          </View>
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.inputHeader}>
            <View style={[styles.inputIcon, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="cash-outline" size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputTitle, { color: colors.text }]}>Price per Litre</Text>
              <Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter price per litre (KES).</Text>
            </View>
          </View>
          <View style={[styles.fuelInputWrap, { borderColor: '#10B981', backgroundColor: colors.inputBg }]}>
            <TextInput
              style={[styles.fuelInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={pricePerLiter}
              onChangeText={setPricePerLiter}
            />
            <Text style={[styles.fuelSuffix, { color: colors.textMuted }]}>KES/L</Text>
          </View>
          {fuelAmount && pricePerLiter ? (
            <View style={{ marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Total Cost:</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>
                KES {(parseFloat(fuelAmount) * parseFloat(pricePerLiter)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: fuelAmount && !submitting ? '#F59E0B' : colors.border }]}
          onPress={handleSubmit}
          disabled={submitting || !fuelAmount || parseFloat(fuelAmount) <= 0}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}
          <Text style={styles.submitBtnText}>{submitting ? 'Dispensing...' : 'Dispense Fuel'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={closeFuelForm} disabled={submitting}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <>
      <PageShell
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}
      >
        <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
        <SectionTitle title={`${filtered.length} trucks`} />
        {loading ? (
          <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
        ) : filtered.length ? (
          filtered.map((item) => {
            const jobFuelAmt = getJobFuelAmount(item.jobId || item.id);
            const recordCount = getJobFuelRecordCount(item.jobId || item.id);
            return (
              <DataCard key={item.id} onPress={() => openFuelForm(item)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.poNumber || 'No PO'}</Text>
                  </View>
                </View>
                <DetailRow icon="person-outline" value={`${item.driverName || 'N/A'} · ${item.plateNumber || 'N/A'}`} />
                <DetailRow icon="business-outline" value={`Vendor: ${item.vendorName || 'N/A'}`} />
                {jobFuelAmt > 0 && (
                  <View style={[styles.fuelInfo, { backgroundColor: '#F59E0B10' }]}>
                    <Ionicons name="water" size={14} color="#F59E0B" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>
                      {jobFuelAmt.toFixed(1)} L dispensed ({recordCount} record{recordCount !== 1 ? 's' : ''})
                    </Text>
                  </View>
                )}
                <View style={[styles.tapHint, { backgroundColor: `${colors.primary}08` }]}>
                  <Ionicons name="hand-left-outline" size={12} color={colors.primary} />
                  <Text style={[styles.tapHintText, { color: colors.primary }]}>Tap to dispense fuel</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
              </DataCard>
            );
          })
        ) : (
          <EmptyState icon="water-outline" title="No trucks" subtitle="No matching jobs found." />
        )}
      </PageShell>

      {/* FAB Button to search/select job ID */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#F59E0B' }]}
        onPress={openJobSearch}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Job Search / Select Modal */}
      <Modal
        visible={jobSearchVisible}
        transparent
        animationType="slide"
        onRequestClose={closeJobSearch}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.addSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md }}>
              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Job ID</Text>
                  <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
                    All jobs (POMAT###/V###/D###/T###/J####). Completed jobs are hidden. Tap to dispense fuel.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.inputBg }]} onPress={closeJobSearch}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.jobSearchInput, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.jobSearchTextInput, { color: colors.text }]}
                  placeholder="Search Job ID, driver, plate, vendor..."
                  placeholderTextColor={colors.textTertiary}
                  value={jobSearchQuery}
                  onChangeText={setJobSearchQuery}
                  autoFocus
                />
              </View>

              <View style={styles.optionList}>
                {jobSearchResults.length ? (
                  jobSearchResults.map((job) => (
                    <TouchableOpacity
                      key={job.id}
                      style={[styles.optionRow, { borderColor: colors.border }]}
                      onPress={() => selectJobFromSearch(job)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionTitle, { color: colors.text }]}>{job.jobId}</Text>
                        <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                          {job.driverName || 'N/A'} · {job.plateNumber || 'N/A'} · {job.vendorName || 'N/A'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg }}>
                    No matching jobs found.
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  jobCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  jobCardTitle: { fontSize: 18, fontWeight: '800' },
  jobPo: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  inputIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputTitle: { fontSize: 16, fontWeight: '700' },
  inputSub: { fontSize: 12, marginTop: 2 },
  fuelInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 64, flexDirection: 'row', alignItems: 'center' },
  fuelInput: { flex: 1, fontSize: 28, fontWeight: '800' },
  fuelSuffix: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm, minHeight: 50, marginTop: Spacing.sm },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm },
  cancelText: { fontSize: 14, fontWeight: '600' },
  tapHint: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginTop: 6 },
  tapHintText: { fontSize: 11, fontWeight: '700' },
  // FAB and Modal styles
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  addSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobSearchInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  jobSearchTextInput: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
  optionList: { gap: Spacing.sm },
  optionRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionTitle: { fontSize: 14, fontWeight: '900' },
  optionMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  // New styles for completion status
  statChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    minWidth: 72,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  fuelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  existingFuel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    minHeight: 50,
    marginTop: Spacing.sm,
    borderWidth: 2,
  },
  completeBtnText: { fontSize: 15, fontWeight: '800' },
});
