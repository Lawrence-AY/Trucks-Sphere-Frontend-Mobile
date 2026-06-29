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
  FilterRail,
  PageShell,
  ProgressBar,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'weighbridge', label: 'Weighbridge' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'flagged', label: 'Flagged' },
];

function progressForDelivery(item: any) {
  if (item.status === 'delivered' || item.status === 'completed') return 100;
  if (item.receivedAt) return 92;
  if (item.deliveredAt || item.status === 'destination_weighbridge') return 78;
  if (item.weighOutWeight || item.status === 'in_transit') return 58;
  if (item.weighInWeight || item.status === 'at_quarry') return 38;
  if (item.driverId || item.vehicleId || item.status === 'assigned') return 18;
  return 8;
}

function isFlagged(item: any) {
  const net = Number(item.netWeight || 0);
  return net > 0 && (net < 19 || net > 23);
}

export default function ActiveScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = await fetchDeliveryOrders();
      setDeliveries(data || []);
    } catch (error) {
      console.error('Active deliveries load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return deliveries.filter((item) => {
      const matchesSearch = !query || [
        item.jobId,
        item.poNumber,
        item.driverName,
        item.plateNumber,
        item.vendorName,
        item.materialName,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      if (!matchesSearch) return false;
      if (filter === 'active') return !['delivered', 'completed', 'cancelled'].includes(item.status);
      if (filter === 'weighbridge') return Boolean(item.weighInWeight || item.weighOutWeight || item.status?.includes('weigh'));
      if (filter === 'delivered') return ['delivered', 'completed'].includes(item.status);
      if (filter === 'flagged') return isFlagged(item);
      return true;
    });
  }, [deliveries, filter, search]);

  const activeCount = deliveries.filter((item) => !['delivered', 'completed', 'cancelled'].includes(item.status)).length;
  const flaggedCount = deliveries.filter(isFlagged).length;

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader
        eyebrow="Delivery execution"
        title="Active board"
        subtitle={`${activeCount} in motion · ${flaggedCount} weight flags`}
      />

      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate, vendor..." />
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />

      <SectionTitle title={`${filtered.length} deliveries`} />
      {loading ? (
        <DataCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading movement board...</Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const progress = progressForDelivery(item);
          const flagged = isFlagged(item);
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/delivery-note?id=${item.jobId}`)}>
              <View style={styles.cardTop}>
                <View style={styles.cardTitleWrap}>
                  <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
                  <Text style={[styles.subtle, { color: colors.textMuted }]}>{item.vendorName || item.poNumber}</Text>
                </View>
                <StatusPill status={flagged ? 'suspended' : item.status} compact />
              </View>

              <ProgressBar value={progress} color={flagged ? colors.danger : colors.accent} />

              <View style={styles.detailGrid}>
                <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No truck'}`} />
                <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || item.quantity || 0} tonnes`} />
                <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} -> ${item.siteName || 'Destination'}`} />
                <DetailRow icon="scale-outline" value={`Net ${item.netWeight || 'pending'} t`} />
              </View>

              <View style={styles.cardFooter}>
                <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
                <Text style={[styles.progressText, { color: flagged ? colors.danger : colors.accent }]}>
                  {progress}% complete
                </Text>
              </View>
            </DataCard>
          );
        })
      ) : (
        <EmptyState
          icon="file-tray-outline"
          title="No deliveries found"
          subtitle={search ? 'Try a broader search or another filter.' : 'There are no matching deliveries on this board.'}
        />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontWeight: '700' },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  cardTitleWrap: { flex: 1 },
  jobId: { fontSize: 17, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  detailGrid: { gap: 7 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  timestamp: { fontSize: 11, fontWeight: '700' },
  progressText: { fontSize: 11, fontWeight: '900' },
});
