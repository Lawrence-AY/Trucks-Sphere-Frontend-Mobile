import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { fetchVehicles, fetchDrivers, fetchDeliveryOrders } from '../../services/api';
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
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [vehicleData, driverData, deliveryData] = await Promise.all([
        fetchVehicles(),
        fetchDrivers(),
        fetchDeliveryOrders(),
      ]);
      setVehicles((vehicleData || []).filter((v: any) => v.vendorId === vendorId));
      setDrivers((driverData || []).filter((d: any) => d.vendorId === vendorId));
      setDeliveries((deliveryData || []).filter((d: any) => d.vendorId === vendorId));
    } catch (error) {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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

  const activeCount = vehiclesWithStats.filter((v) => v.status === 'active').length;

  return (
    <PageShell
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
      }
    >
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="car" size={18} color={colors.accent} />
          <Text style={[styles.statValue, { color: colors.text }]}>{vehiclesWithStats.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={[styles.statValue, { color: colors.text }]}>{activeCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
        </View>
      </View>

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
                <Ionicons name="person-outline" size={14} color={colors.primary} />
                <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                  {vehicle.assignedDriver?.name || 'No driver'}
                </Text>
              </View>
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
            <DetailRow icon="speedometer-outline" value={`Capacity: ${vehicle.capacity || 'N/A'} tonnes`} />
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