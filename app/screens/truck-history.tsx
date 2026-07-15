import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchVehicles, fetchWeighments, fetchDeliveryOrders, fetchVendors, fetchDrivers } from '../../services/api';

function getPlate(matchValue: any, truckPlate: string, truckPlateNumber: string): boolean {
  const t = (matchValue || '').toLowerCase().trim();
  const p1 = (truckPlate || '').toLowerCase().trim();
  const p2 = (truckPlateNumber || '').toLowerCase().trim();
  return (p1 && t === p1) || (p2 && t === p2) || (p1 && t.includes(p1)) || (p2 && t.includes(p2));
}

export default function TruckHistoryScreen() {
  const { id, plate } = useLocalSearchParams<{ id: string; plate: string }>();
  const colors = useTheme();
  const [truck, setTruck] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    console.log('[TruckHistory] Fetching data for truck:', id, plate);
    Promise.all([
      fetchVehicles(),
      fetchDeliveryOrders(),
      fetchVendors(),
      fetchDrivers(),
    ]).then(([vehicles, deliveries, vendors, driversData]) => {
      setDrivers(driversData || []);
      console.log('[TruckHistory] Loaded vehicles:', vehicles.length, 'deliveries:', deliveries.length);
      const foundTruck = vehicles.find((t: any) =>
        t.id === id || t.registrationNumber === plate || t.plateNumber === plate || t.plate === plate
      );
      if (foundTruck) {
        // Resolve vendor name from vendors list
        const vendorId = foundTruck.vendorId;
        const matchedVendor = vendorId
          ? vendors.find((v: any) => v.id === vendorId || v.vendorId === vendorId)
          : null;
        foundTruck.vendorName = foundTruck.vendorName || matchedVendor?.companyName || matchedVendor?.name || '';
      }
      setTruck(foundTruck || null);
      const truckPlate = foundTruck?.plate || foundTruck?.plateNumber || plate || '';
      const truckPlateNumber = foundTruck?.plateNumber || foundTruck?.plate || plate || '';

      if (foundTruck) {
        const truckTrips = deliveries.filter((d: any) => {
          const tripPlate = d.plateNumber || d.truckPlate || '';
          const tripId = d.vehicleId || '';
          return getPlate(tripPlate, truckPlate, truckPlateNumber)
            || tripId === id
            || (d.vehicleId && d.vehicleId === id);
        });
        fetchWeighments().then(weighments => {
          const weighTrips = weighments.filter((w: any) =>
            getPlate(w.truckPlate || w.plateNumber || '', truckPlate, truckPlateNumber)
            || w.vehicleId === id
          );
          const allIds = new Set(truckTrips.map(t => t.id || t.jobId));
          const merged = [...truckTrips];
          weighTrips.forEach((w: any) => {
            const wid = w.id || w.jobId;
            if (!allIds.has(wid)) {
              merged.push(w);
              allIds.add(wid);
            }
          });
          setTrips(merged);
          console.log('[TruckHistory] Found', merged.length, 'trips for truck');
        }).catch(() => {
          setTrips(truckTrips);
          console.log('[TruckHistory] Found', truckTrips.length, 'trips for truck');
        });
      }
    }).catch(err => console.error('[TruckHistory] Failed to load data:', err));
  }, [id, plate]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {truck && (
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.profileTop}>
            <View style={[styles.plateCircle, { backgroundColor: colors.accent + '15' }]}>
              <Text style={[styles.plateText, { color: colors.accent }]}>{truck.plate || truck.plateNumber}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>{truck.model}</Text>
              {truck.vendorName ? (
                <View style={styles.vendorRow}>
                  <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.profileDetail, { color: colors.textSecondary }]}>
                    {truck.vendorName}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.profileDetail, { color: colors.textTertiary }]}>No vendor</Text>
              )}
              {truck.driverName || truck.currentDriverName ? (
                <Text style={[styles.profileDetail, { color: colors.textTertiary }]}>
                  Driver: {truck.driverName || truck.currentDriverName}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{truck.capacity || '-'}T</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Capacity</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{trips.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
            </View>
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Trip History</Text>
      {trips.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="car-outline" size={40} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No trips recorded</Text>
        </View>
      ) : (
        trips.map((trip, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              const navId = trip.jobId || trip.id;
              if (trip.jobId) {
                router.push(`/screens/job-details?id=${trip.jobId}` as any);
              } else if (trip.id) {
                router.push(`/screens/weigh-receipt?id=${trip.id}` as any);
              }
            }}
          >
            <View style={styles.tripTop}>
              <Text style={[styles.tripJob, { color: colors.accent }]}>
                {trip.jobId || trip.id}
              </Text>
              <Text style={[styles.tripStatus, { color: trip.status === 'completed' || trip.status === 'delivered' ? '#16A34A' : '#2563EB' }]}>
                {(trip.status || trip.type || '').replace(/_/g, ' ')}
              </Text>
            </View>
            {trip.driverName ? (
              <View style={styles.tripRow}>
                {(() => {
                  const driverPhoto = drivers.find((d: any) =>
                    d.id === trip.driverId || d.driverId === trip.driverId || d.name === trip.driverName || d.fullName === trip.driverName
                  )?.photoURL;
                  return driverPhoto ? (
                    <Image source={{ uri: driverPhoto }} style={styles.driverThumb} />
                  ) : (
                    <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                  );
                })()}
                <Text style={[styles.tripText, { color: colors.textSecondary }]}>{trip.driverName}</Text>
              </View>
            ) : null}
            {trip.receiptNoteId ? (
              <View style={styles.tripRow}>
                <Ionicons name="receipt-outline" size={14} color="#10B981" />
                <Text style={[styles.tripText, { color: '#10B981', fontWeight: '700' }]} numberOfLines={1}>
                  {trip.receiptNoteId}
                </Text>
              </View>
            ) : null}
            <View style={styles.tripRow}>
              <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.tripText, { color: colors.textSecondary }]}>{trip.material || trip.materialName || 'N/A'}</Text>
            </View>
            {(trip.quarryWeighIn || trip.weighInWeight || trip.weightIn) != null && (
              <View style={styles.tripRow}>
                <Ionicons name="download-outline" size={14} color="#F59E0B" />
                <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                  Quarry In: {Number(trip.quarryWeighIn || trip.weighInWeight || trip.weightIn).toFixed(1)}T
                </Text>
              </View>
            )}
            {(trip.quarryWeighOut || trip.weighOutWeight || trip.weightOut) != null && (
              <View style={styles.tripRow}>
                <Ionicons name="arrow-up-circle-outline" size={14} color="#8B5CF6" />
                <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                  Quarry Out: {Number(trip.quarryWeighOut || trip.weighOutWeight || trip.weightOut).toFixed(1)}T
                </Text>
              </View>
            )}
            {trip.quarryNetWeight != null && (
              <View style={styles.tripRow}>
                <Ionicons name="analytics-outline" size={14} color="#2563EB" />
                <Text style={[styles.tripText, { color: '#2563EB', fontWeight: '700' }]}>
                  Quarry Net: {Number(trip.quarryNetWeight).toFixed(1)}T
                </Text>
              </View>
            )}
            {trip.netWeight != null && !trip.quarryNetWeight && (
              <View style={styles.tripRow}>
                <Ionicons name="analytics-outline" size={14} color="#2563EB" />
                <Text style={[styles.tripText, { color: '#2563EB', fontWeight: '700' }]}>
                  Net: {Number(trip.netWeight).toFixed(1)}T
                </Text>
              </View>
            )}
            {(trip.siteWeighInWeight || trip.siteWeighIn) != null && (
              <View style={styles.tripRow}>
                <Ionicons name="scale-outline" size={14} color="#F59E0B" />
                <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                  Site In: {Number(trip.siteWeighInWeight || trip.siteWeighIn).toFixed(1)}T
                </Text>
              </View>
            )}
            {(trip.siteWeighOutWeight || trip.siteWeighOut) != null && (
              <View style={styles.tripRow}>
                <Ionicons name="arrow-up-circle-outline" size={14} color="#8B5CF6" />
                <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                  Site Out: {Number(trip.siteWeighOutWeight || trip.siteWeighOut).toFixed(1)}T
                </Text>
              </View>
            )}
            {trip.siteNetWeight != null && (
              <View style={styles.tripRow}>
                <Ionicons name="trending-up-outline" size={14} color="#10B981" />
                <Text style={[styles.tripText, { color: '#10B981', fontWeight: '700' }]}>
                  Site Net: {Number(trip.siteNetWeight).toFixed(1)}T
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  profileCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
  profileTop: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  plateCircle: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  plateText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700' },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  profileDetail: { fontSize: 13, marginTop: 1 },
  statsRow: { flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  tripCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  tripTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  tripJob: { fontSize: 14, fontWeight: '700' },
  tripStatus: { fontSize: 12, fontWeight: '600' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 4 },
  driverThumb: { width: 20, height: 20, borderRadius: 10 },
  tripText: { fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});