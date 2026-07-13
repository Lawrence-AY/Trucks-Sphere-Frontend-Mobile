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
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';
import { Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchMaterials, fetchPurchaseOrders } from '../../services/api';
import { formatEAT } from '../../utils/helpers';

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
    const vendors = new Set(orders.map((order) => order.vendorId || order.vendorName).filter(Boolean));
    return {
      ordered,
      vendors: vendors.size,
    };
  }, [orders]);

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
      <CommandHeader
        eyebrow={material.category || 'Material'}
        title={material.name}
      
      />

      <View style={styles.metricRow}>
        <MetricTile icon="document-text" label="Purchase orders" value={orders.length} tone={colors.primary} />
        <MetricTile icon="briefcase" label="Linked vendors" value={summary.vendors} tone={colors.accent} />
      </View>

      <SectionTitle title="Purchase Orders" />
      {orders.length ? (
        orders.map((order) => {
          const jobs = deliveries.filter((job) => job.purchaseOrderId === order.id || job.poNumber === order.poNumber);

          return (
            <DataCard key={order.id} onPress={() => router.push(`/screens/purchase-order?id=${order.id}`)}>
              <View style={styles.cardHead}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.poNumber, { color: colors.text }]}>{order.poNumber}</Text>
                  <Text style={[styles.summarySub, { color: colors.textMuted }]}>{order.vendorName}</Text>
                </View>
              
              </View>
              <DetailRow icon="cube-outline" value={`${Math.round(order.quantity || 0)} ${order.unit || material.unit || 'units'} ordered`} />
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
  summarySub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  poNumber: { fontSize: 17, fontWeight: '900' },
  timestamp: { fontSize: 11, fontWeight: '700' },
  jobLine: { borderTopWidth: 1, paddingTop: Spacing.md, gap: 5 },
  jobId: { fontSize: 14, fontWeight: '900' },
  jobMeta: { fontSize: 12, fontWeight: '700' },
});