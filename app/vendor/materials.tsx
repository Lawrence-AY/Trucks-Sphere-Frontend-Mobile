import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchMaterials, fetchPurchaseOrders } from '../../services/api';
import { CommandHeader, DataCard, DetailRow, EmptyState, PageShell, ProgressBar, SearchField, SectionTitle } from '../../components/EnterpriseUI';

export default function VendorMaterialsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
  const [materials, setMaterials] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [m, o, d] = await Promise.all([fetchMaterials(), fetchPurchaseOrders(), fetchDeliveryOrders()]);
      setMaterials(m || []);
      setOrders((o || []).filter((x: any) => x.vendorId === vendorId));
      setDeliveries((d || []).filter((x: any) => x.vendorId === vendorId));
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const materialCards = useMemo(() => {
    const query = search.toLowerCase();
    return materials
      .map((mat) => {
        const matOrders = orders.filter((o) => o.materialId === mat.id || o.materialName === mat.name);
        const ordered = matOrders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);
        const delivered = matOrders.reduce((sum, o) => sum + (o.deliveredQuantity || 0), 0);
        return { ...mat, purchaseOrderCount: matOrders.length, ordered, delivered, completion: ordered ? Math.round((delivered / ordered) * 100) : 0 };
      })
      .filter((item) => item.purchaseOrderCount > 0 && (!query || (item.name || '').toLowerCase().includes(query)));
  }, [deliveries, materials, orders, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Materials" title="My materials" subtitle="Materials linked to your purchase orders" />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search material..." />
      <SectionTitle title={`${materialCards.length} materials`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : materialCards.length ? (
        materialCards.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.name}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: item.completion >= 100 ? colors.success : colors.primary }}>{item.completion}%</Text>
            </View>
            <ProgressBar value={item.completion} color={item.completion >= 100 ? colors.success : colors.primary} />
            <DetailRow icon="cube-outline" value={`${Math.round(item.delivered)}/${Math.round(item.ordered)} ${item.unit || 'units'} delivered`} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials" subtitle="No materials linked to your orders." />
      )}
    </PageShell>
  );
}