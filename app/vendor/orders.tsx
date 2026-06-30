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

export default function VendorOrdersScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchPurchaseOrders()) || [];
      setOrders(data.filter((o: any) => o.vendorId === vendorId));
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((item) => {
      const matchesSearch = !query || [item.poNumber, item.materialName]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return matchesSearch && (filter === 'all' || item.status === filter);
    });
  }, [filter, orders, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="My procurement" title="My orders" subtitle={`${orders.length} purchase orders`} />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search PO, material..." />
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />
      <SectionTitle title={`${filtered.length} orders`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading orders...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/purchase-order?id=${item.id}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.poNumber}</Text>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.materialName}</Text>
              </View>
              <StatusPill status={item.status} compact />
            </View>
            <DetailRow icon="cube-outline" value={`${item.quantity || 0} ${item.unit || 'units'}`} />
            <DetailRow icon="cash-outline" value={formatCurrency(item.totalAmount || 0)} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="document-text-outline" title="No orders" subtitle="No purchase orders found." />
      )}
    </PageShell>
  );
}