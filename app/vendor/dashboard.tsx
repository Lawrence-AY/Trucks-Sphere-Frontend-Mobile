import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchDrivers, fetchPurchaseOrders, fetchVehicles, fetchFuelRecords } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
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

export default function VendorDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
  const vendorName = user?.displayName || 'Vendor';
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [driverData, vehicleData, orderData, deliveryData, fuelData] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
        fetchFuelRecords(),
      ]);
      setDrivers((driverData || []).filter((d: any) => d.vendorId === vendorId));
      setVehicles((vehicleData || []).filter((v: any) => v.vendorId === vendorId));
      setOrders((orderData || []).filter((o: any) => o.vendorId === vendorId));
      setDeliveries((deliveryData || []).filter((d: any) => d.vendorId === vendorId));
      setFuelRecords(fuelData || []);
    } catch (error) {
      console.error('Vendor dashboard error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const activeTrips = useMemo(
    () => deliveries.filter((d) => !['completed', 'delivered', 'received', 'cancelled'].includes(d.status)).length,
    [deliveries]
  );
  const completedTrips = useMemo(
    () => deliveries.filter((d) => ['completed', 'delivered', 'received'].includes(d.status)).length,
    [deliveries]
  );

  const totalFuelForVendor = useMemo(
    () => fuelRecords.filter((f) => f.vendorId === vendorId).reduce((s, r) => s + (r.fuelAmount || 0), 0),
    [fuelRecords, vendorId]
  );

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 5);
  }, [deliveries]);

  const getJobFuel = (jobId: string) =>
    fuelRecords.filter((f) => f.jobId === jobId).reduce((sum, f) => sum + (f.fuelAmount || 0), 0);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader
        eyebrow={`Vendor ${vendorId.toUpperCase()}`}
        title={vendorName}
        subtitle={`${drivers.length} drivers · ${vehicles.length} trucks · ${orders.length} POs`}
      />
      <View style={styles.metricRow}>
        <MetricTile icon="document-text" label="Orders" value={orders.length} tone={colors.primary} onPress={() => router.push('/vendor/orders' as any)} />
        <MetricTile icon="people" label="Drivers" value={drivers.length} tone={colors.accent} onPress={() => router.push('/vendor/drivers' as any)} />
      </View>
      <View style={styles.metricRow}>
        <MetricTile icon="car" label="Trucks" value={vehicles.length} tone={colors.success} onPress={() => router.push('/vendor/trucks' as any)} />
        <MetricTile icon="layers" label="Trips" value={deliveries.length} tone={colors.warning} onPress={() => router.push('/vendor/trips' as any)} />
      </View>
      <View style={styles.metricRow}>
        <MetricTile icon="checkmark-done" label="Completed" value={completedTrips} tone="#10B981" />
        <MetricTile icon="water" label="Total Fuel" value={`${totalFuelForVendor.toFixed(0)} L`} tone="#F59E0B" />
      </View>

      <SectionTitle title="Recent trips" action={
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.accent }} onPress={() => router.push('/vendor/trips' as any)}>View all</Text>
      } />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : recentDeliveries.length ? (
        recentDeliveries.map((item) => {
          const jobFuel = getJobFuel(item.jobId || '');
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId || item.id}` as any)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId || item.id}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>PO: {item.poNumber || 'N/A'}</Text>
                </View>
                <StatusPill status={item.status} />
              </View>
              <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No vehicle'}`} />
              <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} ${item.unit || 'tonnes'}`} />
              {jobFuel > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F59E0B10' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>{jobFuel.toFixed(1)} L fuel</Text>
                </View>
              )}
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="cube-outline" title="No recent trips" subtitle="No deliveries yet for your vendor account." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
});