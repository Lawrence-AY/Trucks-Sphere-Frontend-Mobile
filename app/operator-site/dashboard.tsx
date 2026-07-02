import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
  
} from '../../components/EnterpriseUI';

export default function OperatorSiteDashboardScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const scheduled = deliveries.filter((d) => !['cancelled'].includes(d.status));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scheduled.filter(
      (d) =>
        !q ||
        [d.jobId, d.driverName, d.plateNumber, d.materialName].some((v) =>
          String(v || '').toLowerCase().includes(q),
        ),
    );
  }, [scheduled, search]);

  const stats = useMemo(() => {
    const arrived = scheduled.filter((d) => d.status === 'delivered' || d.status === 'completed');
    const inTransit = scheduled.filter(
      (d) => !['delivered', 'completed', 'cancelled'].includes(d.status),
    );
    return { arrived: arrived.length, inTransit: inTransit.length };
  }, [scheduled]);

  return (
    <PageShell
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
      }
    >
      <View style={styles.metricRow}>
        <MetricTile icon="calendar" label="Scheduled" value={scheduled.length} tone={colors.primary} />
        <MetricTile icon="car-outline" label="In Transit" value={stats.inTransit} tone={colors.warning} />
        <MetricTile icon="checkmark-done" label="Arrived" value={stats.arrived} tone={colors.success} />
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
      <SectionTitle title={`${filtered.length} deliveries`} />

      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading schedule...</Text></DataCard>
      ) : filtered.length ? (
        filtered.slice(0, 20).map((item) => {
          const hasQuarryWeights = item.weighInWeight != null && item.weighOutWeight != null;
          const netFromQuarry = hasQuarryWeights
            ? (item.netWeight ?? item.weighInWeight - item.weighOutWeight)
            : null;

          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId}` as any)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
                  <Text style={[styles.poText, { color: colors.textMuted }]}>{item.poNumber || 'No PO'}</Text>
                </View>
               </View>
              <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
              <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
              <DetailRow icon="business-outline" value={`Vendor: ${item.vendorName || 'N/A'}`} />
              <DetailRow icon="location-outline" value={`From: ${item.quarryName || 'Quarry'}`} />

              {netFromQuarry != null && (
                <View style={[styles.quarryNetBadge, { backgroundColor: '#2563EB12', borderColor: '#2563EB33' }]}>
                  <Ionicons name="cube-outline" size={12} color="#2563EB" />
                  <Text style={[styles.quarryNetLabel, { color: '#2563EB' }]}>
                    Quarry Net: {netFromQuarry.toFixed(1)}T
                  </Text>
                </View>
              )}

              <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                {item.status === 'delivered' || item.status === 'completed'
                  ? `Arrived: ${formatEAT(item.receivedAt || item.deliveredAt || item.updatedAt)}`
                  : `Dispatched: ${formatEAT(item.weighOutAt || item.updatedAt || item.createdAt)}`}
              </Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="calendar-outline" title="No deliveries" subtitle="No job cards have been dispatched yet." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  jobId: { fontSize: 16, fontWeight: '700' },
  poText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  quarryNetBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, marginTop: Spacing.sm },
  quarryNetLabel: { fontSize: 12, fontWeight: '700' },
  timestamp: { fontSize: 12, marginTop: Spacing.sm },
});
