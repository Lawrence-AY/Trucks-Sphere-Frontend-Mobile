import { useMemo, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeCollection } from '@/store/realtimeData';
import { useRealTimeSyncStore } from '@/store/realTimeSyncStore';
import { normalizeVendorId } from '../../utils/helpers';
import { getPurchaseOrderMaterials } from '../../utils/poMaterials';
import { DataCard, DetailRow, EmptyState, FilterRail, PageShell, SearchField, SectionTitle } from '../../components/EnterpriseUI';

function lineMatchesMaterial(line: any, material: any) {
  if (line.materialId && String(line.materialId) === String(material.id)) return true;
  const lineName = String(line.materialName || line.productName || '').trim().toLowerCase();
  const materialName = String(material.name || '').trim().toLowerCase();
  return Boolean(lineName && materialName && lineName === materialName);
}

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
  const purchaseOrderLines = useMemo(() => orders.flatMap((order: any) =>
    getPurchaseOrderMaterials(order).map((line: any) => ({ order, line }))
  ), [orders]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh('materials'), refresh('purchaseOrders')]);
    } catch {
    } finally {
      setRefreshing(false);
    }
  };

  const linkedMaterials = useMemo(() => materials.filter((material: any) =>
    purchaseOrderLines.some(({ line }) => lineMatchesMaterial(line, material))
  ), [materials, purchaseOrderLines]);

  const materialOptions = useMemo(() => [
    { key: 'all', label: 'All Materials' },
    ...linkedMaterials.map((material: any) => ({ key: material.id, label: material.name || material.id })),
  ], [linkedMaterials]);

  const materialCards = useMemo(() => {
    const query = search.toLowerCase();
    return linkedMaterials
      .map((material: any) => {
        const matchingLines = purchaseOrderLines.filter(({ line }) => lineMatchesMaterial(line, material));
        const matOrders = [...new Map(matchingLines.map(({ order }) => [order.id, order])).values()];
        const ordered = matchingLines.reduce((sum, { line, order }) => sum + Number(line.quantity ?? line.quantityOrdered ?? order.quantity ?? 0), 0);
        return { ...material, purchaseOrderCount: matOrders.length, ordered };
      })
      .filter((item) => {
        const matchesFilter = materialFilter === 'all' || item.id === materialFilter;
        return item.purchaseOrderCount > 0 && (!query || (item.name || '').toLowerCase().includes(query)) && matchesFilter;
      });
  }, [linkedMaterials, materialFilter, purchaseOrderLines, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
       <SearchField title="Materials" icon="cube-outline" value={search} onChangeText={setSearch} placeholder="Search material..." />
       <FilterRail options={materialOptions} value={materialFilter} onChange={setMaterialFilter} />
      <View style={{ gap: 6 }}>
      <SectionTitle title={`${materialCards.length} materials`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : materialCards.length ? (
        <View style={{ gap: 6 }}>{materialCards.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.name}</Text>
            </View>
            <DetailRow icon="cube-outline" value={`${Math.round(item.ordered)} ${item.unit || 'units'} ordered`} />
          </DataCard>
        ))}</View>
      ) : (
        <EmptyState icon="cube-outline" title="No materials" subtitle="No materials linked to your orders." />
      )}
      </View>
    </PageShell>
  );
}
