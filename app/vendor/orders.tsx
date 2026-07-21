import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { useRealtimeCollection } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { formatEAT, normalizeVendorId } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  FilterRail,
  PageShell,
  SearchField,
  SectionTitle,
 
} from '../../components/EnterpriseUI';


export default function VendorOrdersScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
  const normalizedUserVendorId = normalizeVendorId(vendorId);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const { data: allOrders, loading } = useRealtimeCollection('purchaseOrders');
  const orders = useMemo(() => allOrders.filter((o: any) =>
    normalizeVendorId(o.vendorId || o.vendor || '') === normalizedUserVendorId
  ), [allOrders, normalizedUserVendorId]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      await refresh('purchaseOrders');
    } catch {
    } finally {
      setRefreshing(false);
    }
  };

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
       <SearchField value={search} onChangeText={setSearch} placeholder="Search PO, material..." />
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
          
            </View>
            <DetailRow icon="cube-outline" value={`${item.quantity || 0} ${item.unit || 'units'}`} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="document-text-outline" title="No orders" subtitle="No purchase orders found." />
      )}
    </PageShell>
  );
}
