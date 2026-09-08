import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchWarehouseJobs } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { WarehouseJob } from '../../store/types';

export default function WarehouseReportsScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const [jobs, setJobs] = useState<WarehouseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setJobs(await fetchWarehouseJobs() as WarehouseJob[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const report = useMemo(() => {
    const mine = jobs.filter((job) => job.createdByUid === user?.uid);
    const products = mine.reduce((total, job) => total + (job.items?.length || 0), 0);
    const vendors = new Set(mine.map((job) => job.vendorId).filter(Boolean)).size;
    const latest = mine[0]?.submittedAt ? new Date(mine[0].submittedAt).toLocaleDateString() : '—';
    return { shipments: mine.length, products, vendors, latest, awaiting: mine.filter((job) => job.status === 'SUBMITTED').length, accepted: mine.filter((job) => (job.status as string) === 'ACCEPTED').length, inspected: mine.filter((job) => (job.status as string) === 'INSPECTED').length };
  }, [jobs, user?.uid]);

  if (loading) return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
    >
      <Text style={[styles.intro, { color: colors.textMuted }]}>A summary of your warehouse shipments.</Text>
      <View style={styles.grid}>
        <Metric icon="cube-outline" label="Shipments" value={report.shipments} color="#2563EB" />
        <Metric icon="time-outline" label="Awaiting acceptance" value={report.awaiting} color="#F59E0B" />
        <Metric icon="checkmark-circle-outline" label="Awaiting inspection" value={report.accepted} color="#2563EB" />
        <Metric icon="clipboard-outline" label="Inspected" value={report.inspected} color="#10B981" />
        <Metric icon="layers-outline" label="Products" value={report.products} color="#10B981" />
        <Metric icon="business-outline" label="Vendors" value={report.vendors} color="#F59E0B" />
        <Metric icon="calendar-outline" label="Latest shipment" value={report.latest} color="#8B5CF6" />
      </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metric: { width: '48%', borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  metricIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs},
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { fontSize: 12, fontWeight: '600', marginTop: Spacing.xs},
});
