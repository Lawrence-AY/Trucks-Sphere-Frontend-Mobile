import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchDrivers, fetchPurchaseOrders, fetchVehicles, fetchVendors } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
   DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';

function isDelayed(item: any) {
  if (['delivered', 'completed', 'cancelled'].includes(item.status)) return false;
  const changedAt = new Date(item.updatedAt || item.createdAt || Date.now()).getTime();
  return Date.now() - changedAt > 6 * 60 * 60 * 1000;
}

export default function ManagementDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [driverData, vehicleData, orderData, deliveryData, vendorData] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
        fetchVendors(),
      ]);
      setDrivers(driverData || []);
      setVehicles(vehicleData || []);
      setDeliveries(deliveryData || []);
      setVendors(vendorData || []);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => {
    const activeTrips = deliveries.filter((item) => !['delivered', 'completed', 'cancelled'].includes(item.status));
    const deliveredTrips = deliveries.filter((item) => ['delivered', 'completed'].includes(item.status));
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
    };
  }, [deliveries, drivers, vehicles, vendors]);

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 4);
  }, [deliveries]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
 
      <View style={styles.metricGrid}>
        <View style={styles.metricRow}>
          <MetricTile icon="trail-sign" label="Total trips" value={stats.totalTrips} tone={colors.primary} />
          <MetricTile icon="navigate-circle" label="Active trips" value={stats.activeTrips} tone={colors.accent} />
        </View>
        <View style={styles.metricRow}>
          <MetricTile icon="checkmark-done-circle" label="Delivered" value={stats.delivered} tone={colors.success} />
          <MetricTile icon="alert-circle" label="Delayed" value={stats.delayed} tone={stats.delayed ? colors.danger : colors.success} />
        </View>
        <View style={styles.metricRow}>
          <MetricTile icon="briefcase" label="Vendors" value={stats.totalVendors} tone={colors.warning} />
          <MetricTile icon="people" label="Drivers" value={stats.totalDrivers} tone={colors.primary} />
          <MetricTile icon="car" label="Vehicles" value={stats.totalVehicles} tone={colors.accent} />
        </View>
      </View>

      <SectionTitle title="Recent trips" />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading operational feed...</Text></DataCard>
      ) : recentDeliveries.length ? (
        recentDeliveries.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.poNumber || 'Unlinked PO'}</Text>
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No vehicle'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
            <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} → ${item.siteName || 'Destination'}`} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="checkmark-circle-outline" title="No recent trips" subtitle="All delivery activity is currently settled." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  signal: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  signalDot: { width: 8, height: 8, borderRadius: 4 },
  signalText: { fontSize: 14, fontWeight: '600' },
  metricGrid: { gap: Spacing.md },
  metricRow: { flexDirection: 'row', gap: Spacing.md },
});