import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { useRealtimeCollection } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { normalizeVendorId } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';
import { Spacing } from '../../constants/theme';

export default function VendorTrucksScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
  const normalizedUserVendorId = normalizeVendorId(vendorId);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const { data: allVehicles, loading: vehiclesLoading } = useRealtimeCollection('vehicles');
  const { data: allDrivers, loading: driversLoading } = useRealtimeCollection('drivers');
  const { data: allDeliveries, loading: deliveriesLoading } = useRealtimeCollection('deliveryOrders');
  const vehicles = useMemo(() => allVehicles.filter((v: any) =>
    normalizeVendorId(v.vendorId || v.vendor || '') === normalizedUserVendorId
  ), [allVehicles, normalizedUserVendorId]);
  const drivers = useMemo(() => allDrivers.filter((d: any) =>
    normalizeVendorId(d.vendorId || d.vendor || '') === normalizedUserVendorId
  ), [allDrivers, normalizedUserVendorId]);
  const deliveries = useMemo(() => allDeliveries.filter((d: any) =>
    normalizeVendorId(d.vendorId || d.vendor || '') === normalizedUserVendorId
  ), [allDeliveries, normalizedUserVendorId]);
  const loading = vehiclesLoading || driversLoading || deliveriesLoading;

  const loadData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh('vehicles'), refresh('drivers'), refresh('deliveryOrders')]);
    } catch (error) {
    } finally {
      setRefreshing(false);
    }
  };

  const vehiclesWithStats = useMemo(() => {
    const query = search.toLowerCase();
    return vehicles
      .map((vehicle) => {
        const assignedDriver = drivers.find((d) => d.id === vehicle.assignedDriverId);
        const vehicleTrips = deliveries.filter((d) => d.vehicleId === vehicle.id || d.plateNumber === vehicle.plateNumber);
        const completedTrips = vehicleTrips.filter((d) =>
          ['completed', 'delivered', 'received'].includes(d.status)
        );
        const activeTrips = vehicleTrips.filter((d) =>
          !['completed', 'delivered', 'received', 'cancelled'].includes(d.status)
        );
        return {
          ...vehicle,
          assignedDriver,
          totalTrips: vehicleTrips.length,
          completedTrips: completedTrips.length,
          activeTrips: activeTrips.length,
          status: vehicle.status || 'active',
        };
      })
      .filter((v) =>
        !query ||
        (v.plateNumber || '').toLowerCase().includes(query) ||
        (v.make || '').toLowerCase().includes(query) ||
        (v.model || '').toLowerCase().includes(query) ||
        (v.assignedDriver?.name || '').toLowerCase().includes(query)
      );
  }, [vehicles, drivers, deliveries, search]);

 
  return (
    <PageShell
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
      }
    >


      <SearchField value={search} onChangeText={setSearch} placeholder="Search plate, make, model, driver..." />
      <SectionTitle title={`${vehiclesWithStats.length} trucks`} />

      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading trucks...</Text></DataCard>
      ) : vehiclesWithStats.length ? (
        vehiclesWithStats.map((vehicle) => (
          <DataCard
            key={vehicle.id}
            onPress={() =>
              router.push(`/screens/truck-history?id=${vehicle.id}&plate=${encodeURIComponent(vehicle.plateNumber || vehicle.plate || '')}` as any)
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={[styles.truckIcon, { backgroundColor: `${colors.accent}15` }]}>
                <Ionicons name="car" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                      {vehicle.plateNumber || vehicle.plate}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                      {vehicle.make} {vehicle.model} ({vehicle.year || 'N/A'})
                    </Text>
                  </View>
            
                </View>
              </View>
            </View>
            <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            
              <View style={styles.miniStat}>
                <Ionicons name="layers-outline" size={14} color={colors.accent} />
                <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                  {vehicle.totalTrips} trips
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Ionicons name="checkmark-done-outline" size={14} color="#10B981" />
                <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                  {vehicle.completedTrips} done
                </Text>
              </View>
            </View>
          </DataCard>
        ))
      ) : (
        <EmptyState
          icon="car-outline"
          title="No trucks found"
          subtitle="No trucks linked to your vendor account."
        />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  statChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  truckIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatText: { fontSize: 12, fontWeight: '600' },
});
