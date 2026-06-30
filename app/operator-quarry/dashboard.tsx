import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

export default function OperatorQuarryDashboardScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchDeliveryOrders()) || [];
      setDeliveries(data);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const queue = deliveries.filter((d) => !['delivered', 'completed', 'cancelled'].includes(d.status));
  const completed = deliveries.filter((d) => d.status === 'delivered' || d.status === 'completed');

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Quarry operations" title="Queue" subtitle={`${deliveries.length} jobs`} />
      <View style={styles.metricRow}>
        <MetricTile icon="clipboard" label="In queue" value={queue.length} tone={colors.warning} />
        <MetricTile icon="checkmark-done" label="Completed" value={completed.length} tone={colors.success} />
      </View>
      <SectionTitle title="Active queue" />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading queue...</Text></DataCard>
      ) : queue.length ? (
        queue.slice(0, 10).map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
              <StatusPill status={item.status} compact />
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="clipboard-outline" title="Queue empty" subtitle="No active jobs in the quarry queue." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
});