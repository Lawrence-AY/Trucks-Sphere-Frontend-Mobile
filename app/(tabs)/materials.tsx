import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchMaterials, fetchPurchaseOrders } from '../../services/api';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  ProgressBar,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

function deliveredFor(order: any, deliveries: any[]) {
  const linked = deliveries.filter((item) => item.purchaseOrderId === order.id || item.poNumber === order.poNumber);
  const delivered = linked.reduce((sum, item) => sum + Number(item.quantityDelivered || 0), 0);
  if (delivered) return delivered;
  if (order.deliveredQuantity != null) return Number(order.deliveredQuantity);
  if (order.status === 'completed') return Number(order.quantity || 0);
  return 0;
}

export default function MaterialsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [materials, setMaterials] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const vendorId = user?.role === 'vendor' ? user.vendorId || 'v1' : null;

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [materialData, orderData, deliveryData] = await Promise.all([
        fetchMaterials(),
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
      ]);
      setMaterials(materialData || []);
      setOrders(vendorId ? (orderData || []).filter((item: any) => item.vendorId === vendorId) : orderData || []);
      setDeliveries(vendorId ? (deliveryData || []).filter((item: any) => item.vendorId === vendorId) : deliveryData || []);
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

  const materialCards = useMemo(() => {
    const query = search.toLowerCase();
    return materials
      .map((material) => {
        const materialOrders = orders.filter((order) => order.materialId === material.id || order.materialName === material.name);
        const ordered = materialOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
        const delivered = materialOrders.reduce((sum, order) => sum + deliveredFor(order, deliveries), 0);
        const vendors = new Set(materialOrders.map((order) => order.vendorId || order.vendorName).filter(Boolean));
        const jobs = deliveries.filter((job) => job.materialId === material.id || job.materialName === material.name).length;
        return {
          ...material,
          purchaseOrderCount: materialOrders.length,
          ordered,
          delivered,
          remaining: Math.max(0, ordered - delivered),
          completion: ordered ? Math.round((delivered / ordered) * 100) : 0,
          vendorCount: vendors.size,
          jobs,
        };
      })
      .filter((item) => {
        const hasRecords = item.purchaseOrderCount > 0 || !vendorId;
        const matchesSearch = !query || [item.name, item.category, item.description]
          .some((value) => String(value || '').toLowerCase().includes(query));
        return hasRecords && matchesSearch;
      })
      .sort((a, b) => b.ordered - a.ordered);
  }, [deliveries, materials, orders, search, vendorId]);

  const totals = useMemo(() => {
    const ordered = materialCards.reduce((sum, item) => sum + item.ordered, 0);
    const delivered = materialCards.reduce((sum, item) => sum + item.delivered, 0);
    return {
      ordered,
      delivered,
      remaining: Math.max(0, ordered - delivered),
      completion: ordered ? Math.round((delivered / ordered) * 100) : 0,
    };
  }, [materialCards]);

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

      <DataCard>
        <View style={styles.summaryHead}>
          <View>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>{totals.completion}% delivered</Text>
            <Text style={[styles.summarySub, { color: colors.textMuted }]}>
              {Math.round(totals.delivered)}/{Math.round(totals.ordered)} ordered units
            </Text>
          </View>
          <Text style={[styles.remaining, { color: colors.warning }]}>{Math.round(totals.remaining)} left</Text>
        </View>
        <ProgressBar value={totals.completion} color={colors.primary} />
      </DataCard>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search material, category..." />
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
                  {item.purchaseOrderCount} POs - {item.jobs} jobs
                </Text>
              </View>
              <Text style={[styles.percent, { color: item.completion >= 100 ? colors.success : colors.primary }]}>
                {item.completion}%
              </Text>
            </View>
            <ProgressBar value={item.completion} color={item.completion >= 100 ? colors.success : colors.primary} />
            <DetailRow icon="download-outline" value={`Ordered ${Math.round(item.ordered)} ${item.unit || 'units'}`} />
            <DetailRow icon="checkmark-done-outline" value={`Delivered ${Math.round(item.delivered)} ${item.unit || 'units'}`} />
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
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  summaryTitle: { fontSize: 21, fontWeight: '900' },
  summarySub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  remaining: { fontSize: 15, fontWeight: '900' },
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  percent: { fontSize: 18, fontWeight: '900' },
});
