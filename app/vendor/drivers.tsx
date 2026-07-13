import { useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { fetchDrivers, fetchVehicles, fetchDeliveryOrders } from '../../services/api';
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

export default function VendorDriversScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [driverData, vehicleData, deliveryData] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchDeliveryOrders(),
      ]);
      setDrivers((driverData || []).filter((d: any) => d.vendorId === vendorId));
      setVehicles((vehicleData || []).filter((v: any) => v.vendorId === vendorId));
      setDeliveries((deliveryData || []).filter((d: any) => d.vendorId === vendorId));
    } catch (error) {
      console.error('Vendor drivers error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const driverWithStats = useMemo(() => {
    const query = search.toLowerCase();
    return drivers
      .map((driver) => {
        const assignedVehicle = vehicles.find((v) => v.id === driver.assignedTruckId);
        const driverTrips = deliveries.filter((d) => d.driverId === driver.id);
        const completedTrips = driverTrips.filter((d) =>
          ['completed', 'delivered', 'received'].includes(d.status)
        );
        const activeTrips = driverTrips.filter((d) =>
          !['completed', 'delivered', 'received', 'cancelled'].includes(d.status)
        );
        return {
          ...driver,
          assignedVehicle,
          totalTrips: driverTrips.length,
          completedTrips: completedTrips.length,
          activeTrips: activeTrips.length,
          status: driver.status || 'active',
        };
      })
      .filter((d) =>
        !query ||
        (d.name || '').toLowerCase().includes(query) ||
        (d.assignedVehicle?.plateNumber || '').toLowerCase().includes(query)
      );
  }, [drivers, vehicles, deliveries, search]);

  const activeCount = driverWithStats.filter((d) => d.status === 'active').length;

  return (
    <PageShell
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
      }
    >
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="people" size={18} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>{driverWithStats.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={[styles.statValue, { color: colors.text }]}>{activeCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
        </View>
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search driver name, plate..." />
      <SectionTitle title={`${driverWithStats.length} drivers`} />

      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading drivers...</Text></DataCard>
      ) : driverWithStats.length ? (
        driverWithStats.map((driver) => (
          <DataCard
            key={driver.id}
            onPress={() =>
              router.push(`/screens/driver-history?id=${driver.id}&name=${encodeURIComponent(driver.name)}` as any)
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              {driver.photoURL ? (
                <Image source={{ uri: driver.photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>
                    {(driver.name || 'D').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                    {driver.name}
                  </Text>
                
                </View>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                  {driver.phone || 'No phone'}
                </Text>
              </View>
            </View>
            <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
              <View style={styles.miniStat}>
                <Ionicons name="car-outline" size={14} color={colors.accent} />
                <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                  {driver.assignedVehicle?.plateNumber || 'No truck'}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Ionicons name="layers-outline" size={14} color={colors.primary} />
                <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                  {driver.totalTrips} trips
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Ionicons name="checkmark-done-outline" size={14} color="#10B981" />
                <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                  {driver.completedTrips} done
                </Text>
              </View>
            </View>
            <DetailRow icon="id-card-outline" value={`License: ${driver.licenseNumber || 'N/A'}`} />
          </DataCard>
        ))
      ) : (
        <EmptyState
          icon="people-outline"
          title="No drivers found"
          subtitle="No drivers linked to your vendor account."
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
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