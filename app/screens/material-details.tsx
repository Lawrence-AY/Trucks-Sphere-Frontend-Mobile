import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  ProgressBar,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';
import { Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchMaterials, fetchPurchaseOrders } from '../../services/api';
import { formatCurrency, formatEAT } from '../../utils/helpers';

function deliveredFor(order: any, deliveries: any[]) {
  const linked = deliveries.filter((item) => item.purchaseOrderId === order.id || item.poNumber === order.poNumber);
  const delivered = linked.reduce((sum, item) => sum + Number(item.quantityDelivered || 0), 0);
  if (delivered) return delivered;
  if (order.deliveredQuantity != null) return Number(order.deliveredQuantity);
  if (order.status === 'completed') return Number(order.quantity || 0);
  return 0;
}

export default function MaterialDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const { user } = useAuthStore();
  const [material, setMaterial] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const vendorId = user?.role === 'vendor' ? user.vendorId || 'v1' : null;

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setError('No material selected.');
        setLoading(false);
        return;
      }

      try {
        const [materialData, orderData, deliveryData] = await Promise.all([
          fetchMaterials(),
          fetchPurchaseOrders(),
          fetchDeliveryOrders(),
        ]);
        const found = (materialData || []).find((item: any) => item.id === id);
        if (!found) {
          setError(`No material found for ${id}.`);
          return;
        }

        const visibleOrders = vendorId ? (orderData || []).filter((item: any) => item.vendorId === vendorId) : orderData || [];
        const visibleDeliveries = vendorId ? (deliveryData || []).filter((item: any) => item.vendorId === vendorId) : deliveryData || [];
        setMaterial(found);
        setOrders(visibleOrders.filter((order: any) => order.materialId === found.id || order.materialName === found.name));
        setDeliveries(visibleDeliveries.filter((job: any) => job.materialId === found.id || job.materialName === found.name));
      } catch (loadError) {
        console.error('Material details load error:', loadError);
        setError('Failed to load material details.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, vendorId]);

  const summary = useMemo(() => {
    const ordered = orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
    const delivered = orders.reduce((sum, order) => sum + deliveredFor(order, deliveries), 0);
    const vendors = new Set(orders.map((order) => order.vendorId || order.vendorName).filter(Boolean));
    return {
      ordered,
      delivered,
      remaining: Math.max(0, ordered - delivered),
      completion: ordered ? Math.round((delivered / ordered) * 100) : 0,
      vendors: vendors.size,
      value: orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    };
  }, [deliveries, orders]);

  if (loading) {
    return (
      <PageShell>
        <DataCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.muted, { color: colors.textMuted }]}>Loading material...</Text>
          </View>
        </DataCard>
      </PageShell>
    );
  }

  if (error || !material) {
    return (
      <PageShell>
        <EmptyState icon="cube-outline" title="Material not found" subtitle={error || 'This material could not be loaded.'} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      

      <View style={styles.metricRow}>
        <MetricTile icon="document-text" label="Purchase orders" value={orders.length} tone={colors.primary} />
        <MetricTile icon="briefcase" label="Linked vendors" value={summary.vendors} tone={colors.accent} />
      </View>

      <DataCard>
        <View style={styles.summaryHead}>
          <View>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>{summary.completion}% delivered</Text>
            <Text style={[styles.summarySub, { color: colors.textMuted }]}>{formatCurrency(summary.value)} ordered value</Text>
          </View>
          <Text style={[styles.remaining, { color: colors.warning }]}>
            {Math.round(summary.remaining)} {material.unit || 'units'} left
          </Text>
        </View>
        <ProgressBar value={summary.completion} color={summary.completion >= 100 ? colors.success : colors.primary} />
      </DataCard>

      <SectionTitle title="Purchase Orders" />
      {orders.length ? (
        orders.map((order) => {
          const delivered = deliveredFor(order, deliveries);
          const ordered = Number(order.quantity || 0);
          const pct = ordered ? Math.round((delivered / ordered) * 100) : 0;
          const jobs = deliveries.filter((job) => job.purchaseOrderId === order.id || job.poNumber === order.poNumber);

          return (
            <DataCard key={order.id} onPress={() => router.push(`/screens/purchase-order?id=${order.id}`)}>
              <View style={styles.cardHead}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.poNumber, { color: colors.text }]}>{order.poNumber}</Text>
                  <Text style={[styles.summarySub, { color: colors.textMuted }]}>{order.vendorName}</Text>
                </View>
                <StatusPill status={order.status} compact />
              </View>
              <ProgressBar value={pct} color={pct >= 100 ? colors.success : colors.primary} />
              <DetailRow icon="cube-outline" value={`${Math.round(delivered)}/${Math.round(ordered)} ${order.unit || material.unit || 'units'} delivered`} />
              <DetailRow icon="navigate-outline" value={`${order.quarryName || 'Origin'} to ${order.siteName || 'Destination'}`} />
              <DetailRow icon="git-branch-outline" value={`${jobs.length} linked jobs`} />
              <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{formatEAT(order.createdAt)}</Text>

              {jobs.map((job) => (
                <View key={job.id} style={[styles.jobLine, { borderColor: colors.border }]}>
                  <Text style={[styles.jobId, { color: colors.text }]} onPress={() => router.push(`/screens/job-details?id=${job.jobId}`)}>
                    {job.jobId}
                  </Text>
                  <Text style={[styles.jobMeta, { color: colors.textMuted }]}>
                    {job.driverName || 'Unassigned'} - {job.plateNumber || 'No vehicle'}
                  </Text>
                  <StatusPill status={job.status} compact />
                </View>
              ))}
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="document-text-outline" title="No purchase orders" subtitle="No visible purchase orders are linked to this material." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  muted: { fontSize: 13, fontWeight: '800' },
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  summaryTitle: { fontSize: 21, fontWeight: '900' },
  summarySub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  remaining: { fontSize: 14, fontWeight: '900', textAlign: 'right' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  poNumber: { fontSize: 17, fontWeight: '900' },
  timestamp: { fontSize: 11, fontWeight: '700' },
  jobLine: { borderTopWidth: 1, paddingTop: Spacing.md, gap: 5 },
  jobId: { fontSize: 14, fontWeight: '900' },
  jobMeta: { fontSize: 12, fontWeight: '700' },
});
