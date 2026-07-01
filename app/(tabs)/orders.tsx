import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchPurchaseOrders, fetchMaterials } from '../../services/api';
import { formatCurrency, formatEAT } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  FilterRail,
  MetricTile,
  PageShell,
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

export default function OrdersScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [data, matData] = await Promise.all([
        fetchPurchaseOrders(),
        fetchMaterials(),
      ]);
      setOrders(user?.role === 'vendor' ? (data || []).filter((item: any) => item.vendorId === (user.vendorId || 'v1')) : data || []);
      setMaterials(matData || []);
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

  const materialOptions = useMemo(() => {
    return [{ key: 'all', label: 'All Materials' }, ...materials.map((m: any) => ({ key: m.id, label: m.name || m.id }))];
  }, [materials]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((item) => {
      const matchesSearch = !query || [item.poNumber, item.vendorName, item.materialName]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesFilter = filter === 'all' || item.status === filter;
      const matchesMaterial = materialFilter === 'all' || item.materialId === materialFilter;
      return matchesSearch && matchesFilter && matchesMaterial;
    });
  }, [filter, materialFilter, orders, search]);

  const summary = useMemo(() => {
    const ordered = orders.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const vendors = new Set(orders.map((item) => item.vendorId || item.vendorName));
    return {
      ordered,
      vendors: vendors.size,
      value: orders.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    };
  }, [orders]);

  const vendorSummary = useMemo(() => {
    const map = new Map<string, { vendor: string; ordered: number; count: number }>();
    orders.forEach((item) => {
      const vendor = item.vendorName || 'Unknown Vendor';
      const current = map.get(vendor) || { vendor, ordered: 0, count: 0 };
      current.ordered += Number(item.quantity || 0);
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
        subtitle={`${summary.vendors} vendors · ${orders.length} orders`}
      />

      <View style={styles.metricRow}>
        <MetricTile icon="cube" label="Ordered qty" value={Math.round(summary.ordered)} tone={colors.primary} />
        <MetricTile icon="cash-outline" label="Total Value" value={formatCurrency(summary.value)} tone={colors.success} />
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search PO, vendor, material..." />
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />
      <FilterRail options={materialOptions} value={materialFilter} onChange={setMaterialFilter} />

      <SectionTitle title={`${filtered.length} purchase orders`} />
      {loading ? (
        <DataCard>
          <Text style={[styles.summarySub, { color: colors.textMuted }]}>Loading purchase orders...</Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const ordered = Number(item.quantity || 0);
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/purchase-order?id=${item.id}`)}>
              <View style={styles.cardHead}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.poNumber, { color: colors.text }]}>{item.poNumber}</Text>
                  <Text style={[styles.summarySub, { color: colors.textMuted }]}>{item.vendorName}</Text>
                </View>
                <StatusPill status={item.status} compact />
              </View>
              <DetailRow icon="cube-outline" value={`${item.materialName} · ${Math.round(ordered)} ${item.unit || 'units'}`} />
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
  summarySub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  poNumber: { fontSize: 17, fontWeight: '900' },
  timestamp: { fontSize: 11, fontWeight: '700' },
});