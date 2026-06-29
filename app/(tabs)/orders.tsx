import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchPurchaseOrders } from '../../services/api';
import { formatCurrency, formatEAT } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  FilterRail,
  MetricTile,
  PageShell,
  ProgressBar,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

function deliveredFor(order: any) {
  if (order.deliveredQuantity != null) return Number(order.deliveredQuantity);
  if (order.status === 'completed') return Number(order.quantity || 0);
  if (order.status === 'in_progress') return Math.round(Number(order.quantity || 0) * 0.45);
  return 0;
}

export default function OrdersScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = await fetchPurchaseOrders();
      setOrders(user?.role === 'vendor' ? (data || []).filter((item: any) => item.vendorId === (user.vendorId || 'v1')) : data || []);
    } catch (error) {
      console.error('Orders load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role, user?.vendorId]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((item) => {
      const matchesSearch = !query || [item.poNumber, item.vendorName, item.materialName]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesFilter = filter === 'all' || item.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, orders, search]);

  const summary = useMemo(() => {
    const ordered = orders.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const delivered = orders.reduce((sum, item) => sum + deliveredFor(item), 0);
    const vendors = new Set(orders.map((item) => item.vendorId || item.vendorName));
    return {
      ordered,
      delivered,
      remaining: Math.max(0, ordered - delivered),
      vendors: vendors.size,
      completion: ordered ? Math.round((delivered / ordered) * 100) : 0,
      value: orders.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    };
  }, [orders]);

  const vendorSummary = useMemo(() => {
    const map = new Map<string, { vendor: string; ordered: number; delivered: number; count: number }>();
    orders.forEach((item) => {
      const vendor = item.vendorName || 'Unknown Vendor';
      const current = map.get(vendor) || { vendor, ordered: 0, delivered: 0, count: 0 };
      current.ordered += Number(item.quantity || 0);
      current.delivered += deliveredFor(item);
      current.count += 1;
      map.set(vendor, current);
    });
    return [...map.values()].sort((a, b) => b.ordered - a.ordered).slice(0, 3);
  }, [orders]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader
        eyebrow="Procurement execution"
        title="Purchase orders"
        subtitle={`${summary.vendors} vendors · ${Math.round(summary.remaining)} remaining units`}
      />

      <View style={styles.metricRow}>
        <MetricTile icon="cube" label="Ordered qty" value={Math.round(summary.ordered)} tone={colors.primary} />
        <MetricTile icon="checkmark-done" label="Delivered" value={Math.round(summary.delivered)} tone={colors.success} />
      </View>

      <DataCard>
        <View style={styles.summaryHead}>
          <View>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>{summary.completion}% fulfilled</Text>
            <Text style={[styles.summarySub, { color: colors.textMuted }]}>{formatCurrency(summary.value)} total value</Text>
          </View>
          <Text style={[styles.remaining, { color: colors.warning }]}>{Math.round(summary.remaining)} left</Text>
        </View>
        <ProgressBar value={summary.completion} color={colors.accent} />
      </DataCard>

      <SectionTitle title="Vendor summary" />
      {vendorSummary.map((item) => {
        const pct = item.ordered ? Math.round((item.delivered / item.ordered) * 100) : 0;
        return (
          <DataCard key={item.vendor} style={styles.vendorCard}>
            <View style={styles.summaryHead}>
              <View>
                <Text style={[styles.vendorName, { color: colors.text }]}>{item.vendor}</Text>
                <Text style={[styles.summarySub, { color: colors.textMuted }]}>{item.count} purchase orders</Text>
              </View>
              <Text style={[styles.remaining, { color: colors.accent }]}>{pct}%</Text>
            </View>
            <ProgressBar value={pct} color={colors.primary} />
          </DataCard>
        );
      })}

      <SearchField value={search} onChangeText={setSearch} placeholder="Search PO, vendor, material..." />
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />

      <SectionTitle title={`${filtered.length} purchase orders`} />
      {loading ? (
        <DataCard>
          <Text style={[styles.summarySub, { color: colors.textMuted }]}>Loading purchase orders...</Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const delivered = deliveredFor(item);
          const ordered = Number(item.quantity || 0);
          const pct = ordered ? Math.round((delivered / ordered) * 100) : 0;
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/purchase-order?id=${item.id}`)}>
              <View style={styles.cardHead}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.poNumber, { color: colors.text }]}>{item.poNumber}</Text>
                  <Text style={[styles.summarySub, { color: colors.textMuted }]}>{item.vendorName}</Text>
                </View>
                <StatusPill status={item.status} compact />
              </View>
              <ProgressBar value={pct} color={item.status === 'completed' ? colors.success : colors.primary} />
              <DetailRow icon="cube-outline" value={`${item.materialName} · ${Math.round(delivered)}/${Math.round(ordered)} ${item.unit || 'units'}`} />
              <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} -> ${item.siteName || 'Destination'}`} />
              <DetailRow icon="cash-outline" value={formatCurrency(item.totalAmount || 0)} />
              <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{formatEAT(item.createdAt)}</Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="document-text-outline" title="No purchase orders found" subtitle="Adjust the search or filter to see more records." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, alignItems: 'flex-start' },
  summaryTitle: { fontSize: 21, fontWeight: '900' },
  summarySub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  remaining: { fontSize: 15, fontWeight: '900' },
  vendorCard: { paddingVertical: Spacing.md },
  vendorName: { fontSize: 15, fontWeight: '900' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  poNumber: { fontSize: 17, fontWeight: '900' },
  timestamp: { fontSize: 11, fontWeight: '700' },
});
