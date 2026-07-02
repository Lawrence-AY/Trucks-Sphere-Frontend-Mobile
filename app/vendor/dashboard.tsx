import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchDrivers, fetchPurchaseOrders, fetchVehicles } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
 
} from '../../components/EnterpriseUI';

export default function VendorDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
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
      setDrivers((driverData || []).filter((d: any) => d.vendorId === vendorId));
      setVehicles((vehicleData || []).filter((v: any) => v.vendorId === vendorId));
      setOrders((orderData || []).filter((o: any) => o.vendorId === vendorId));
      setDeliveries((deliveryData || []).filter((d: any) => d.vendorId === vendorId));
    } catch (error) {
      console.error('Vendor dashboard error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const recentDeliveries = useMemo(() => {
    return [...deliveries]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 4);
  }, [deliveries]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
       
      <View style={styles.metricRow}>
        <MetricTile icon="document-text" label="My orders" value={orders.length} tone={colors.primary} />
        <MetricTile icon="people" label="My drivers" value={drivers.length} tone={colors.accent} />
      </View>
      <View style={styles.metricRow}>
        <MetricTile icon="car" label="My trucks" value={vehicles.length} tone={colors.success} />
        <MetricTile icon="cube" label="Deliveries" value={deliveries.length} tone={colors.warning} />
      </View>
      <SectionTitle title="Recent trips" />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : recentDeliveries.length ? (
        recentDeliveries.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
        
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No vehicle'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No recent trips" subtitle="No deliveries yet for your vendor account." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
});