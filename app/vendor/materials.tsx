import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { useRealtimeCollection } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { normalizeVendorId } from '../../utils/helpers';
import { CommandHeader, DataCard, DetailRow, EmptyState, FilterRail, PageShell, SearchField, SectionTitle } from '../../components/EnterpriseUI';

export default function VendorMaterialsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
  const normalizedUserVendorId = normalizeVendorId(vendorId);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const { data: materials, loading: materialsLoading } = useRealtimeCollection('materials');
  const { data: allOrders, loading: ordersLoading } = useRealtimeCollection('purchaseOrders');
  const loading = materialsLoading || ordersLoading;
  const orders = useMemo(() => allOrders.filter((x: any) =>
    normalizeVendorId(x.vendorId || x.vendor || '') === normalizedUserVendorId
  ), [allOrders, normalizedUserVendorId]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh('materials'), refresh('purchaseOrders')]);
    } catch {
    } finally {
      setRefreshing(false);
    }
  };

  const materialOptions = useMemo(() => {
    return [{ key: 'all', label: 'All Materials' }, ...materials.map((m: any) => ({ key: m.id, label: m.name || m.id }))];
  }, [materials]);

  const materialCards = useMemo(() => {
    const query = search.toLowerCase();
    return materials
      .map((mat) => {
        const matOrders = orders.filter((o) => o.materialId === mat.id || o.materialName === mat.name);
        const ordered = matOrders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);
        return { ...mat, purchaseOrderCount: matOrders.length, ordered };
      })
      .filter((item) => {
        const matchesFilter = materialFilter === 'all' || item.id === materialFilter;
        return item.purchaseOrderCount > 0 && (!query || (item.name || '').toLowerCase().includes(query)) && matchesFilter;
      });
  }, [materialFilter, materials, orders, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
       <SearchField value={search} onChangeText={setSearch} placeholder="Search material..." />
       <FilterRail options={materialOptions} value={materialFilter} onChange={setMaterialFilter} />
      <SectionTitle title={`${materialCards.length} materials`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : materialCards.length ? (
        materialCards.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.name}</Text>
            </View>
            <DetailRow icon="cube-outline" value={`${Math.round(item.ordered)} ${item.unit || 'units'} ordered`} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials" subtitle="No materials linked to your orders." />
      )}
    </PageShell>
  );
}
