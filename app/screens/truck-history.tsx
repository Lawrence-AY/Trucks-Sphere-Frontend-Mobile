import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { useDeliveryOrders, useVehicles, useVendors, useDrivers } from '../../store/realtimeData';
import { useAuthStore } from '../../store/authStore';
import { normalizeVendorId, formatEAT } from '../../utils/helpers';

/**
 * Bidirectional plate matching — checks if the delivery plate matches the truck plate
 * regardless of which direction contains the shorter substring.
 */
/**
 * Normalize a plate string for comparison: lowercase, trim, remove all spaces/hyphens.
 */
function normalizePlate(plate: string): string {
  return (plate || '').toLowerCase().replace(/[\s\-]/g, '');
}

function getPlate(matchValue: any, truckPlate: string, truckPlateNumber: string): boolean {
  const t = normalizePlate(matchValue || '');
  const p1 = normalizePlate(truckPlate || '');
  const p2 = normalizePlate(truckPlateNumber || '');
  if (!t) return false;
  if (!p1 && !p2) return false;
  // Exact match (after normalization)
  if ((p1 && t === p1) || (p2 && t === p2)) return true;
  // Bidirectional substring — either contains the other
  if ((p1 && (t.includes(p1) || p1.includes(t))) || (p2 && (t.includes(p2) || p2.includes(t)))) return true;
  return false;
}

export default function TruckHistoryScreen() {
  const { id, plate } = useLocalSearchParams<{ id: string; plate: string }>();
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || '';
  const normalizedUserVendorId = normalizeVendorId(vendorId);

  // Use realtime sync hooks — reliable, auto-polling, ETag-supported
  const allVehicles = useVehicles();
  const allDeliveriesRaw = useDeliveryOrders();
  const allVendors = useVendors();
  const allDrivers = useDrivers();

  // Filter deliveries by vendorId using normalized comparison
  const allDeliveries = useMemo(() => {
    if (!normalizedUserVendorId) return allDeliveriesRaw;
    return allDeliveriesRaw.filter((d: any) => {
      const recordVendorId = normalizeVendorId(d.vendorId || d.vendor || '');
      return recordVendorId === normalizedUserVendorId;
    });
  }, [allDeliveriesRaw, normalizedUserVendorId]);

  // Find the truck from realtime sync data
  const truck = useMemo(() => {
    if (!id && !plate) return null;
    const foundTruck = allVehicles.find((t: any) =>
      t.id === id || t.registrationNumber === plate || t.plateNumber === plate || t.plate === plate
    );
    if (foundTruck) {
      const truckVendorId = foundTruck.vendorId;
      const matchedVendor = truckVendorId
        ? allVendors.find((v: any) => v.id === truckVendorId || v.vendorId === truckVendorId)
        : null;
      foundTruck.vendorName = foundTruck.vendorName || matchedVendor?.companyName || matchedVendor?.name || '';
    }
    return foundTruck || null;
  }, [allVehicles, allVendors, id, plate]);

  // Filter trips matching this truck
  const trips = useMemo(() => {
    if (!truck) return [];
    const truckPlate = truck?.plate || truck?.plateNumber || plate || '';
    const truckPlateNumber = truck?.plateNumber || truck?.plate || plate || '';

    return allDeliveries.filter((d: any) => {
      const tripPlate = d.plateNumber || d.truckPlate || '';
      const tripId = d.vehicleId || '';
      return getPlate(tripPlate, truckPlate, truckPlateNumber)
        || tripId === id
        || (d.vehicleId && d.vehicleId === id);
    });
  }, [allDeliveries, truck, id, plate]);

  const drivers = allDrivers;

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
            key={trip.id || i}
            style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              if (trip.jobId) {
                router.push(`/screens/job-details?id=${trip.jobId}` as any);
              }
            }}
          >
            <View style={styles.tripTop}>
              <Text style={[styles.tripJob, { color: colors.accent }]}>
                {trip.jobId || trip.id}
              </Text>
              <Text style={[styles.tripStatus, { color: trip.status === 'completed' || trip.status === 'delivered' ? '#16A34A' : '#2563EB' }]}>
                {(trip.status || '').replace(/_/g, ' ')}
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
            <View style={styles.tripRow}>
              <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.tripText, { color: colors.textSecondary }]}>{trip.material || trip.materialName || 'N/A'}</Text>
            </View>

            {/* Site / Quarry Location Info */}
            {(trip.quarryName || trip.siteName) ? (
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    {trip.quarryName ? (
                      <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                        Quarry: {trip.quarryName}
                      </Text>
                    ) : null}
                    {trip.siteName ? (
                      <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                        Site: {trip.siteName}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}

            {/* Quarry Weigh-In */}
            {(trip.weighInWeight) != null && (
              <View style={styles.weightBlock}>
                <View style={styles.tripRow}>
                  <Ionicons name="download-outline" size={14} color="#F59E0B" />
                  <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                    Quarry In: {Number(trip.weighInWeight).toFixed(1)}T
                  </Text>
                </View>
                {trip.weighInAt ? (
                  <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                    {formatEAT(trip.weighInAt)}
                  </Text>
                ) : null}
              </View>
            )}

            {/* Quarry Weigh-Out */}
            {(trip.weighOutWeight) != null && (
              <View style={styles.weightBlock}>
                <View style={styles.tripRow}>
                  <Ionicons name="arrow-up-circle-outline" size={14} color="#8B5CF6" />
                  <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                    Quarry Out: {Number(trip.weighOutWeight).toFixed(1)}T
                  </Text>
                </View>
                {trip.weighOutAt ? (
                  <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                    {formatEAT(trip.weighOutAt)}
                  </Text>
                ) : null}
              </View>
            )}

            {trip.netWeight != null && (
              <View style={styles.tripRow}>
                <Ionicons name="analytics-outline" size={14} color="#2563EB" />
                <Text style={[styles.tripText, { color: '#2563EB', fontWeight: '700' }]}>
                  Net: {Number(trip.netWeight).toFixed(1)}T
                </Text>
              </View>
            )}

            {/* Site Weigh-In */}
            {(trip.siteWeighInWeight) != null && (
              <View style={styles.weightBlock}>
                <View style={styles.tripRow}>
                  <Ionicons name="scale-outline" size={14} color="#F59E0B" />
                  <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                    Site In: {Number(trip.siteWeighInWeight).toFixed(1)}T
                  </Text>
                </View>
                {trip.siteWeighInAt ? (
                  <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                    {formatEAT(trip.siteWeighInAt)}
                  </Text>
                ) : null}
              </View>
            )}

            {/* Site Weigh-Out */}
            {(trip.siteWeighOutWeight) != null && (
              <View style={styles.weightBlock}>
                <View style={styles.tripRow}>
                  <Ionicons name="arrow-up-circle-outline" size={14} color="#8B5CF6" />
                  <Text style={[styles.tripText, { color: colors.textSecondary }]}>
                    Site Out: {Number(trip.siteWeighOutWeight).toFixed(1)}T
                  </Text>
                </View>
                {trip.siteWeighOutAt ? (
                  <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                    {formatEAT(trip.siteWeighOutAt)}
                  </Text>
                ) : null}
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
  // New styles for quarry/site info and timestamps
  infoSection: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: Radius.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  weightBlock: {
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    marginLeft: 20,
    marginTop: 1,
    fontStyle: 'italic',
  },
});