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

export default function ManagementOrdersScreen() {
  const colors = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = await fetchPurchaseOrders();
      setOrders(data || []);
    } catch (error) {
      console.error('Orders load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
    const delivered = orders.reduce((sum, item) => sum + (item.deliveredQuantity || 0), 0);
    return {
      ordered,
      delivered,
      remaining: Math.max(0, ordered - delivered),
      completion: ordered ? Math.round((delivered / ordered) * 100) : 0,
      value: orders.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    };
  }, [orders]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Procurement" title="Purchase orders" subtitle={`${orders.length} orders · ${formatCurrency(summary.value)} total`} />
      <View style={styles.metricRow}>
        <MetricTile icon="cube" label="Ordered" value={Math.round(summary.ordered)} tone={colors.primary} />
        <MetricTile icon="checkmark-done" label="Delivered" value={Math.round(summary.delivered)} tone={colors.success} />
      </View>
      <DataCard>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{summary.completion}% fulfilled</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.accent }}>{summary.completion}% fulfilled</Text>
        </View>
        <ProgressBar value={summary.completion} color={colors.accent} />
      </DataCard>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search PO, vendor, material..." />
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />
      <SectionTitle title={`${filtered.length} purchase orders`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading purchase orders...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/purchase-order?id=${item.id}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.poNumber}</Text>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.vendorName}</Text>
              </View>
              <StatusPill status={item.status} compact />
            </View>
            <DetailRow icon="cube-outline" value={`${item.materialName} · ${item.quantity || 0} ${item.unit || 'units'}`} />
            <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} → ${item.siteName || 'Destination'}`} />
            <DetailRow icon="cash-outline" value={formatCurrency(item.totalAmount || 0)} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="document-text-outline" title="No orders found" subtitle="Adjust the search or filter." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
});