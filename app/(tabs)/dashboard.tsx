import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchDrivers, fetchMaterials, fetchPurchaseOrders, fetchVehicles, fetchVendors } from '../../services/api';
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

function deliveredFor(order: any, deliveries: any[]) {
  const linked = deliveries.filter((item) => item.purchaseOrderId === order.id || item.poNumber === order.poNumber);
  const delivered = linked.reduce((sum, item) => sum + Number(item.quantityDelivered || 0), 0);
  if (delivered) return delivered;
  if (order.deliveredQuantity != null) return Number(order.deliveredQuantity);
  if (order.status === 'completed') return Number(order.quantity || 0);
  return 0;
}

function isDelayed(item: any) {
  if (['delivered', 'completed', 'cancelled'].includes(item.status)) return false;
  const changedAt = new Date(item.updatedAt || item.createdAt || Date.now()).getTime();
  return Date.now() - changedAt > 6 * 60 * 60 * 1000;
}

export default function DashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const role = user?.role || 'management';
  const roleLabel = getRoleLabel(role);
  const isAdmin = role === 'admin';
  const isManagement = role === 'management' || isAdmin;
  const isOperator = role === 'operator_quarry' || role === 'operator_site';
  const isVendor = role === 'vendor';
  const vendorId = isVendor ? user?.vendorId || 'v1' : null;

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [driverData, vehicleData, orderData, deliveryData, materialData, vendorData] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
        fetchMaterials(),
        fetchVendors(),
      ]);

      const visibleDrivers = vendorId ? (driverData || []).filter((item: any) => item.vendorId === vendorId) : driverData || [];
      const visibleVehicles = vendorId ? (vehicleData || []).filter((item: any) => item.vendorId === vendorId) : vehicleData || [];
      const visibleOrders = vendorId ? (orderData || []).filter((item: any) => item.vendorId === vendorId) : orderData || [];
      const visibleDeliveries = vendorId ? (deliveryData || []).filter((item: any) => item.vendorId === vendorId) : deliveryData || [];

      setDrivers(visibleDrivers);
      setVehicles(visibleVehicles);
      setOrders(visibleOrders);
      setDeliveries(visibleDeliveries);
      setMaterials(materialData || []);
      setVendors(vendorData || []);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const stats = useMemo(() => {
    const activeTrips = deliveries.filter((item) => !['delivered', 'completed', 'cancelled'].includes(item.status));
    const deliveredTrips = deliveries.filter((item) => ['delivered', 'completed'].includes(item.status));
    const ordered = orders.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const deliveredQty = orders.reduce((sum, item) => sum + deliveredFor(item, deliveries), 0);

    return {
      totalTrips: deliveries.length,
      activeTrips: activeTrips.length,
      delivered: deliveredTrips.length,
      delayed: deliveries.filter(isDelayed).length,
      totalVendors: vendors.length,
      totalDrivers: drivers.length,
      totalVehicles: vehicles.length,
      activeDrivers: drivers.filter((item) => item.status === 'active').length,
      activeVehicles: vehicles.filter((item) => item.status === 'active').length,
      completion: ordered ? Math.min(100, Math.round((deliveredQty / ordered) * 100)) : 0,
    };
  }, [deliveries, drivers, orders, vehicles, vendors]);

  const materialCards = useMemo(() => {
    return materials
      .map((material) => {
        const materialOrders = orders.filter((order) => order.materialId === material.id || order.materialName === material.name);
        const ordered = materialOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
        const delivered = materialOrders.reduce((sum, order) => sum + deliveredFor(order, deliveries), 0);
        const jobs = deliveries.filter((job) => job.materialId === material.id || job.materialName === material.name).length;
        return {
          ...material,
          purchaseOrderCount: materialOrders.length,
          ordered,
          delivered,
          jobs,
          completion: ordered ? Math.round((delivered / ordered) * 100) : 0,
        };
      })
      .filter((item) => item.purchaseOrderCount > 0 || !isVendor)
      .sort((a, b) => b.ordered - a.ordered)
      .slice(0, 4);
  }, [deliveries, isVendor, materials, orders]);

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 4);
  }, [deliveries]);

  const quickActions = useMemo(() => {
    if (isVendor) return [];
    if (isAdmin) {
      return [
        { icon: 'settings', label: 'Settings', route: '/(tabs)/profile', color: colors.primary },
        { icon: 'analytics', label: 'Reports', route: '/(tabs)/history', color: colors.accent },
        { icon: 'cube', label: 'Materials', route: '/(tabs)/materials', color: colors.success },
        { icon: 'search', label: 'Search', route: '/(tabs)/search', color: colors.warning },
      ];
    }
    if (isManagement) {
      return [
        { icon: 'analytics', label: 'Reports', route: '/(tabs)/history', color: colors.primary },
        { icon: 'cube', label: 'Materials', route: '/(tabs)/materials', color: colors.accent },
        { icon: 'document-text', label: 'Orders', route: '/(tabs)/orders', color: colors.success },
        { icon: 'search', label: 'Search', route: '/(tabs)/search', color: colors.warning },
      ];
    }
    if (role === 'operator_quarry') {
      return [
        { icon: 'add-circle', label: 'Create Job', route: '/(tabs)/orders', color: colors.primary },
        { icon: 'scale', label: 'Weigh In', route: '/quarry/weigh-in', color: colors.accent },
        { icon: 'arrow-up-circle', label: 'Weigh Out', route: '/quarry/weigh-out', color: colors.success },
        { icon: 'search', label: 'Search', route: '/(tabs)/search', color: colors.warning },
      ];
    }
    return [
      { icon: 'scan', label: 'Receive', route: '/site/receive', color: colors.success },
      { icon: 'cube', label: 'Materials', route: '/(tabs)/materials', color: colors.primary },
      { icon: 'time', label: 'History', route: '/(tabs)/history', color: colors.accent },
      { icon: 'search', label: 'Search', route: '/(tabs)/search', color: colors.warning },
    ];
  }, [colors, isAdmin, isManagement, isVendor, role]);

  const title = isVendor ? 'Vendor workspace' : isOperator ? 'Operations board' : isAdmin ? 'Admin control tower' : 'Management control tower';
  const subtitle = isVendor
    ? `${user?.displayName || 'Vendor'} - own trips, drivers, and vehicles only`
    : `${user?.displayName || 'User'} - ${roleLabel}`;

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader
        eyebrow="Role-aware dashboard"
        title={title}
        subtitle={subtitle}
        right={
          <View style={[styles.signal, { backgroundColor: `${colors.success}18` }]}>
            <View style={[styles.signalDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.signalText, { color: colors.success }]}>Live</Text>
          </View>
        }
      />

      <View style={styles.metricGrid}>
        <View style={styles.metricRow}>
          <MetricTile icon="trail-sign" label="Total trips" value={stats.totalTrips} tone={colors.primary} onPress={() => router.push('/(tabs)/active')} />
          <MetricTile icon="navigate-circle" label="Active trips" value={stats.activeTrips} tone={colors.accent} onPress={() => router.push('/(tabs)/active')} />
        </View>
        <View style={styles.metricRow}>
          <MetricTile icon="checkmark-done-circle" label="Delivered" value={stats.delivered} tone={colors.success} />
          <MetricTile icon="alert-circle" label="Delayed" value={stats.delayed} tone={stats.delayed ? colors.danger : colors.success} />
        </View>
        <View style={styles.metricRow}>
          {isManagement ? (
            <MetricTile icon="briefcase" label="Total vendors" value={stats.totalVendors} tone={colors.warning} />
          ) : null}
          <MetricTile icon="people" label="Total drivers" value={stats.totalDrivers} tone={colors.primary} onPress={() => router.push('/(tabs)/drivers')} />
          <MetricTile icon="car" label="Total vehicles" value={stats.totalVehicles} tone={colors.accent} onPress={() => router.push('/(tabs)/trucks')} />
        </View>
      </View>

      {isManagement ? (
        <DataCard>
          <View style={styles.cardHead}>
            <View>
              <Text style={[styles.cardEyebrow, { color: colors.accent }]}>Reports and analytics</Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{stats.completion}% PO fulfillment</Text>
            </View>
            <Ionicons name="analytics" size={24} color={colors.primary} />
          </View>
          <ProgressBar value={stats.completion} color={colors.accent} />
          <View style={styles.compactStats}>
            <Text style={[styles.compactStat, { color: colors.textSecondary }]}>{stats.activeDrivers} active drivers</Text>
            <Text style={[styles.compactStat, { color: colors.textSecondary }]}>{stats.activeVehicles} active vehicles</Text>
            <Text style={[styles.compactStat, { color: colors.textSecondary }]}>{orders.length} purchase orders</Text>
          </View>
        </DataCard>
      ) : null}

      <SectionTitle
        title="Materials"
        action={
          <TouchableOpacity onPress={() => router.push('/(tabs)/materials')}>
            <Text style={[styles.link, { color: colors.primary }]}>View all</Text>
          </TouchableOpacity>
        }
      />
      {materialCards.length ? (
        materialCards.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}`)}>
            <View style={styles.cardHead}>
              <View style={styles.cardCopy}>
                <Text style={[styles.materialTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.deliveryMeta, { color: colors.textMuted }]}>
                  {item.purchaseOrderCount} POs - {item.jobs} jobs
                </Text>
              </View>
              <Text style={[styles.materialPercent, { color: item.completion >= 100 ? colors.success : colors.primary }]}>
                {item.completion}%
              </Text>
            </View>
            <ProgressBar value={item.completion} color={item.completion >= 100 ? colors.success : colors.primary} />
            <DetailRow icon="cube-outline" value={`${Math.round(item.delivered)}/${Math.round(item.ordered)} ${item.unit || 'units'} delivered`} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No material activity" subtitle="No visible purchase orders are linked to materials yet." />
      )}

      {quickActions.length ? (
        <>
          <SectionTitle title="Quick actions" />
          <View style={styles.actionRow}>
            {quickActions.map((item) => (
              <TouchableOpacity key={item.label} style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push(item.route as any)}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle
        title="Recent trips"
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
          <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId}`)}>
            <View style={styles.deliveryHead}>
              <View>
                <Text style={[styles.deliveryId, { color: colors.text }]}>{item.jobId}</Text>
                <Text style={[styles.deliveryMeta, { color: colors.textMuted }]}>{item.poNumber || 'Unlinked PO'}</Text>
              </View>
              <StatusPill status={isDelayed(item) ? 'delayed' : item.status} compact />
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} - ${item.plateNumber || 'No vehicle'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} - ${item.quantityOrdered || item.quantity || 0} tonnes`} />
            <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} to ${item.siteName || 'Destination'}`} />
            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="checkmark-circle-outline" title="No recent trips" subtitle="All visible delivery activity is currently settled." />
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
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  cardCopy: { flex: 1 },
  cardEyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cardTitle: { fontSize: 21, fontWeight: '900', marginTop: 4 },
  compactStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  compactStat: { fontSize: 12, fontWeight: '700' },
  materialTitle: { fontSize: 17, fontWeight: '900' },
  materialPercent: { fontSize: 18, fontWeight: '900' },
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
