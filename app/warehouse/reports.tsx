import { useWebLiveRefresh } from '../../hooks/useWebLiveRefresh';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchWarehouseJobs } from '../../services/api';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Gap, Radius, Spacing } from '../../constants/theme';
import { WarehouseJob } from '@/store/types';
import { ReportActions } from '../../components/ReportActions';
import { buildCsvContent, buildHtmlContent, shareCsvAsFile, sharePdfAsFile } from '../../utils/exportData';
import { Alert } from 'react-native';

export default function WarehouseReportsScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const [jobs, setJobs] = useState<WarehouseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const mine = useMemo(() => jobs.filter(job => job.createdByUid === user?.uid), [jobs, user?.uid]);
  const exportReport = async (format: string) => {
    setExporting(true);
    try {
      const headers = ['Job ID', 'Purchase Order', 'Vendor', 'Driver', 'Truck Registration', 'Status', 'Product', 'Quantity', 'Unit', 'MRF Source', 'MRF Number', 'Dispatched At'];
      const rows = mine.flatMap(job => (job.items?.length ? job.items : [{}]).map((item: any) => [job.jobId, job.poNumber || '', job.vendorName || '', job.driverName || '', job.plateNumber || '', job.status, item.materialName || item.productName || item.description || '', String(item.quantity ?? ''), item.unit || '', Array.isArray(item.source) ? item.source.join(' | ') : item.source || item.mrfSource || '', item.mrfNo || item.mrfNumber || '', job.dispatchedToSiteAt || job.submittedAt || '']));
      if (format === 'csv') await shareCsvAsFile('Warehouse Shipments', buildCsvContent(headers, rows));
      else await sharePdfAsFile('Warehouse Shipments', buildHtmlContent(headers, rows, 'Warehouse Shipments'));
    } catch (error: any) { Alert.alert('Export failed', error?.message || 'Could not export shipments.'); }
    finally { setExporting(false); }
  };
  const load = useCallback(async () => {
    setJobs(await fetchWarehouseJobs() as WarehouseJob[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useWebLiveRefresh(load);

  const report = useMemo(() => {
    const mine = jobs.filter((job) => job.createdByUid === user?.uid);
    const products = mine.reduce((total, job) => total + (job.items?.length || 0), 0);
    const vendors = new Set(mine.map((job) => job.vendorId).filter(Boolean)).size;
    const latest = mine[0]?.submittedAt ? new Date(mine[0].submittedAt).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—';
    return { shipments: mine.length, products, vendors, latest, awaiting: mine.filter((job) => job.status === 'SUBMITTED').length, accepted: mine.filter((job) => (job.status as string) === 'ACCEPTED').length, inspected: mine.filter((job) => (job.status as string) === 'INSPECTED').length };
  }, [jobs, user?.uid]);

  if (loading) return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primaryText} /></View>;
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
    >
      <Text style={[styles.intro, { color: colors.textMuted }]}>A summary of your warehouse shipments.</Text>
      <View style={styles.grid}>
        <Metric icon="cube-outline" label="Shipments" value={report.shipments} color={colors.blueText} />
        <Metric icon="time-outline" label="Awaiting acceptance" value={report.awaiting} color={colors.warning} />
        <Metric icon="checkmark-circle-outline" label="Awaiting inspection" value={report.accepted} color={colors.blueText} />
        <Metric icon="clipboard-outline" label="Inspected" value={report.inspected} color={colors.success} />
        <Metric icon="close-circle-outline" label="Denied / cancelled" value={jobs.filter(job => job.createdByUid === user?.uid && ['DENIED', 'CANCELLED'].includes(job.status)).length} color={colors.danger} />
        <Metric icon="layers-outline" label="Products" value={report.products} color={colors.success} />
        <Metric icon="business-outline" label="Vendors" value={report.vendors} color={colors.warning} />
        <Metric icon="calendar-outline" label="Latest shipment" value={report.latest} color={colors.purple} />
      </View>
      <ReportActions categories={[{ key: 'csv', label: 'Shipments CSV' }, { key: 'pdf', label: 'Shipments PDF' }]} busy={exporting} onExport={key => { void exportReport(key); }} />
      {mine.map((job, index) => <View key={job.id} style={[styles.metric, { width: '100%', backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{index + 1}. {job.jobId}</Text>
        <Text style={{ color: colors.text }}>Driver: {job.driverName || 'Not captured'}</Text>
        <Text style={{ color: colors.text }}>Truck: {job.plateNumber || 'Not captured'}</Text>
        <Text style={{ color: colors.textMuted }}>{job.vendorName} · {job.status}</Text>
      </View>)}
    </ScrollView>
  );
}

function Metric({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; color: string }) {
  const colors = useTheme();
  return <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={22} color={color} /></View>
    <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.md, paddingBottom: Spacing['3xl'] },
  intro: { fontSize: 13, marginBottom: Spacing.xs},
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Gap},
  metric: { width: '48%', borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  metricIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs},
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { fontSize: 12, fontWeight: '600', marginTop: Spacing.xs},
});
