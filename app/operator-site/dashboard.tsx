import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
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

export default function OperatorSiteDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
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

  const scheduled = deliveries.filter((d) => d.status === 'assigned');
  const arrived = deliveries.filter((d) => d.status === 'delivered' || d.receivedAt);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
       <View style={styles.metricRow}>
        <MetricTile icon="calendar" label="Scheduled" value={scheduled.length} tone={colors.primary} />
        <MetricTile icon="checkmark-done" label="Arrived" value={arrived.length} tone={colors.success} />
      </View>
      <SectionTitle title="Incoming deliveries" />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading schedule...</Text></DataCard>
      ) : scheduled.length ? (
        scheduled.slice(0, 10).map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
              <StatusPill status={item.status} compact />
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="calendar-outline" title="No scheduled deliveries" subtitle="No incoming deliveries at this time." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
});