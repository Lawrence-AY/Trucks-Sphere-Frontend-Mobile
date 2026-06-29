import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchDrivers, fetchPurchaseOrders, fetchVehicles } from '../../services/api';
import { formatEAT, getRoleLabel } from '../../utils/helpers';
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

export default function DashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [driverData, vehicleData, orderData, deliveryData] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
      ]);
      setDrivers(driverData || []);
      setVehicles(vehicleData || []);
      setOrders(orderData || []);
      setDeliveries(deliveryData || []);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const active = deliveries.filter((item) => !['delivered', 'completed', 'cancelled'].includes(item.status));
    const delivered = deliveries.filter((item) => item.status === 'delivered');
    const discrepancy = deliveries.filter((item) => {
      const net = Number(item.netWeight || 0);
      return net > 0 && (net < 19 || net > 23);
    });
    const ordered = orders.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const deliveredQty = deliveries.reduce((sum, item) => sum + Number(item.quantityDelivered || 0), 0);
    return {
      pending: orders.filter((item) => ['pending', 'approved', 'in_progress'].includes(item.status)).length,
      inTransit: active.filter((item) => ['in_transit', 'at_quarry', 'assigned'].includes(item.status)).length,
      deliveredToday: delivered.length,
      reconciled: delivered.filter((item) => item.netWeight).length,
      discrepancies: discrepancy.length,
      activeDrivers: drivers.filter((item) => item.status === 'active').length,
      activeVehicles: vehicles.filter((item) => item.status === 'active').length,
      completion: ordered ? Math.min(100, Math.round((deliveredQty / ordered) * 100)) : 0,
    };
  }, [deliveries, drivers, orders, vehicles]);

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 4);
  }, [deliveries]);

  const role = getRoleLabel(user?.role || 'management');

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader
        eyebrow="Operations command"
        title="Control tower"
        subtitle={`${user?.displayName || 'Operator'} · ${role}`}
        right={
          <View style={[styles.signal, { backgroundColor: `${colors.success}18` }]}>
            <View style={[styles.signalDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.signalText, { color: colors.success }]}>Live</Text>
          </View>
        }
      />

      <View style={styles.metricGrid}>
        <View style={styles.metricRow}>
          <MetricTile icon="file-tray-full" label="Pending deliveries" value={stats.pending} tone={colors.warning} onPress={() => router.push('/(tabs)/orders')} />
          <MetricTile icon="navigate-circle" label="In transit" value={stats.inTransit} tone={colors.primary} onPress={() => router.push('/(tabs)/active')} />
        </View>
        <View style={styles.metricRow}>
          <MetricTile icon="checkmark-done-circle" label="Delivered today" value={stats.deliveredToday} tone={colors.success} />
          <MetricTile icon="alert-circle" label="Weight flags" value={stats.discrepancies} tone={colors.danger} />
        </View>
      </View>

      <DataCard>
        <View style={styles.cardHead}>
          <View>
            <Text style={[styles.cardEyebrow, { color: colors.accent }]}>Purchase order throughput</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{stats.completion}% complete</Text>
          </View>
          <Ionicons name="analytics" size={24} color={colors.primary} />
        </View>
        <ProgressBar value={stats.completion} color={colors.accent} />
        <View style={styles.compactStats}>
          <Text style={[styles.compactStat, { color: colors.textSecondary }]}>{stats.activeDrivers} active drivers</Text>
          <Text style={[styles.compactStat, { color: colors.textSecondary }]}>{stats.activeVehicles} active vehicles</Text>
          <Text style={[styles.compactStat, { color: colors.textSecondary }]}>{stats.reconciled} reconciled</Text>
        </View>
      </DataCard>

      <SectionTitle title="Quick actions" />
      <View style={styles.actionRow}>
        {[
          { icon: 'add-circle', label: 'New order', route: '/(tabs)/orders', color: colors.primary },
          { icon: 'scale', label: 'Weighbridge', route: '/quarry/weigh-in', color: colors.accent },
          { icon: 'scan', label: 'Receive', route: '/site/receive', color: colors.success },
          { icon: 'search', label: 'Search', route: '/(tabs)/search', color: colors.warning },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push(item.route as any)}>
            <Ionicons name={item.icon as any} size={22} color={item.color} />
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionTitle
        title="Recent movement"
        action={
          <TouchableOpacity onPress={() => router.push('/(tabs)/active')}>
            <Text style={[styles.link, { color: colors.primary }]}>View all</Text>
          </TouchableOpacity>
        }
      />
      {loading ? (
        <DataCard>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading operational feed...</Text>
        </DataCard>
      ) : recentDeliveries.length ? (
        recentDeliveries.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/delivery-note?id=${item.jobId}`)}>
            <View style={styles.deliveryHead}>
              <View>
                <Text style={[styles.deliveryId, { color: colors.text }]}>{item.jobId}</Text>
                <Text style={[styles.deliveryMeta, { color: colors.textMuted }]}>{item.poNumber || 'Unlinked PO'}</Text>
              </View>
              <StatusPill status={item.status} compact />
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No vehicle'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || item.quantity || 0} tonnes`} />
            <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} -> ${item.siteName || 'Destination'}`} />
            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="checkmark-circle-outline" title="No active movement" subtitle="All visible deliveries are currently settled." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  signal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
  },
  signalDot: { width: 8, height: 8, borderRadius: 4 },
  signalText: { fontSize: 12, fontWeight: '900' },
  metricGrid: { gap: Spacing.md },
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cardTitle: { fontSize: 21, fontWeight: '900', marginTop: 4 },
  compactStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  compactStat: { fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  action: {
    flex: 1,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '900' },
  loadingText: { fontSize: 13, fontWeight: '700' },
  deliveryHead: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  deliveryId: { fontSize: 16, fontWeight: '900' },
  deliveryMeta: { fontSize: 12, marginTop: 2, fontWeight: '700' },
  timestamp: { fontSize: 11, fontWeight: '700' },
});
