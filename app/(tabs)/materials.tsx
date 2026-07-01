import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchMaterials, fetchPurchaseOrders } from '../../services/api';
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
} from '../../components/EnterpriseUI';

export default function MaterialsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [materials, setMaterials] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');

  const vendorId = user?.role === 'vendor' ? user.vendorId || 'v1' : null;

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [materialData, orderData] = await Promise.all([
        fetchMaterials(),
        fetchPurchaseOrders(),
      ]);
      setMaterials(materialData || []);
      setOrders(vendorId ? (orderData || []).filter((item: any) => item.vendorId === vendorId) : orderData || []);
    } catch (error) {
      console.error('Materials load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const materialOptions = useMemo(() => {
    return [{ key: 'all', label: 'All Materials' }, ...materials.map((m: any) => ({ key: m.id, label: m.name || m.id }))];
  }, [materials]);

  const materialCards = useMemo(() => {
    const query = search.toLowerCase();
    return materials
      .map((material) => {
        const materialOrders = orders.filter((order) => order.materialId === material.id || order.materialName === material.name);
        const ordered = materialOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
        const vendors = new Set(materialOrders.map((order) => order.vendorId || order.vendorName).filter(Boolean));
        return {
          ...material,
          purchaseOrderCount: materialOrders.length,
          ordered,
          vendorCount: vendors.size,
        };
      })
      .filter((item) => {
        const hasRecords = item.purchaseOrderCount > 0 || !vendorId;
        const matchesSearch = !query || [item.name, item.category]
          .some((value) => String(value || '').toLowerCase().includes(query));
        const matchesMaterial = materialFilter === 'all' || item.id === materialFilter;
        return hasRecords && matchesSearch && matchesMaterial;
      })
      .sort((a, b) => b.ordered - a.ordered);
  }, [materials, materialFilter, orders, search, vendorId]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader
        eyebrow="Delivery materials"
        title="Materials"
        subtitle={user?.role === 'vendor' ? 'Materials linked to your purchase orders' : 'Purchase orders grouped by material'}
      />

      <View style={styles.metricRow}>
        <MetricTile icon="cube" label="Materials" value={materialCards.length} tone={colors.primary} />
        <MetricTile icon="document-text" label="Purchase orders" value={orders.length} tone={colors.accent} />
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search material, category..." />
      <FilterRail options={materialOptions} value={materialFilter} onChange={setMaterialFilter} />
      <SectionTitle title={`${materialCards.length} material cards`} />

      {loading ? (
        <DataCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading materials...</Text>
        </DataCard>
      ) : materialCards.length ? (
        materialCards.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}`)}>
            <View style={styles.cardHead}>
              <View style={styles.cardCopy}>
                <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.subtle, { color: colors.textMuted }]}>
                  {item.purchaseOrderCount} POs
                </Text>
              </View>
            </View>
            <DetailRow icon="download-outline" value={`Ordered ${Math.round(item.ordered)} ${item.unit || 'units'}`} />
            <DetailRow icon="business-outline" value={`${item.vendorCount} linked vendors`} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials found" subtitle="Try another search term or refresh the data." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
});