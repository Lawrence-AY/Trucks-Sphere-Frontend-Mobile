import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { fetchWarehouseJobs } from '../../services/api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { WarehouseJob } from '../../store/types';
import { buildCsvContent, shareCsvAsFile } from '../../utils/exportData';

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
] as const;
type HistoryFilter = typeof FILTERS[number]['id'];

function poReference(job: WarehouseJob) {
  return job.poNumber || String(job.warehouseReference || '').split('/').slice(0, 2).join('/');
}

export default function WarehouseHistoryScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const [jobs, setJobs] = useState<WarehouseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('today');

  const load = useCallback(async () => {
    const records = await fetchWarehouseJobs();
    setJobs(records as WarehouseJob[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const myJobs = useMemo(() => jobs.filter((job) => job.createdByUid === user?.uid), [jobs, user?.uid]);
  const filteredJobs = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (filter === 'today') start.setHours(0, 0, 0, 0);
    if (filter === 'week') start.setDate(now.getDate() - 6);
    if (filter === 'month') start.setMonth(now.getMonth() - 1);
    return myJobs.filter((job) => job.submittedAt && new Date(job.submittedAt) >= start);
  }, [filter, myJobs]);
  const downloadCsv = async () => {
    setDownloading(true);
    try {
      await shareCsvAsFile('Warehouse_Shipment_History', buildCsvContent(
        ['Job ID', 'Purchase Order', 'Vendor', 'Receipt Status', 'Accepted At', 'Accepted By', 'Products', 'Submitted At'],
        filteredJobs.map((job) => [
          job.jobId,
          poReference(job),
          job.vendorName,
          job.status,
          job.warehouseAcceptedAt || '',
          job.warehouseAcceptedByName || '',
          (job.items || []).map((item) => `${item.materialName} (${item.quantity} ${item.unit})`).join('; '),
          job.submittedAt || '',
        ]),
      ));
    } catch (error: any) {
      Alert.alert('Download failed', error?.message || 'Could not download shipment history.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredJobs.length ? styles.list : styles.empty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState icon="time-outline" title="No shipments in this period" subtitle="Try another history filter." />}
        ListHeaderComponent={
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.filterChip, { backgroundColor: filter === option.id ? colors.primary : colors.surface, borderColor: filter === option.id ? colors.primary : colors.border }]}
                  onPress={() => setFilter(option.id)}
                >
                  <Text style={[styles.filterText, { color: filter === option.id ? '#FFFFFF' : colors.text }]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredJobs.length ? (
              <TouchableOpacity style={[styles.downloadButton, { backgroundColor: colors.primary }]} onPress={downloadCsv} disabled={downloading}>
                {downloading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="download-outline" size={18} color="#FFFFFF" />}
                <Text style={styles.downloadText}>{downloading ? 'Preparing CSV...' : 'Download CSV'}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
            <Text style={[styles.reference, { color: colors.textMuted }]}>{poReference(item)}</Text>
<View style={styles.detail}><Ionicons name="checkmark-circle-outline" size={15} color={colors.textMuted} /><Text style={[styles.detailText, { color: colors.text }]}>{item.status === 'INSPECTED' ? 'Inspected' : item.status === 'ACCEPTED' ? 'Awaiting inspection' : 'Awaiting site acceptance'}</Text></View>
            <Text style={[styles.date, { color: colors.textMuted }]}>{item.submittedAt ? new Date(item.submittedAt).toLocaleString() : 'Submitted'}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing['3xl'] },
  empty: { flexGrow: 1, padding: Spacing.md },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  jobId: { fontSize: 15, fontWeight: '800' },
  reference: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs},
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.xs},
  detailText: { fontSize: 13, fontWeight: '600' },
  date: { fontSize: 11, marginTop: Spacing.xs},
  downloadButton: { minHeight: 42, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.xs},
  downloadText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  filterRow: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  filterChip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  filterText: { fontSize: 12, fontWeight: '800' },
});
