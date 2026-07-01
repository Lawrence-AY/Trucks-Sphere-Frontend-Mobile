import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDrivers, fetchVehicles, fetchDeliveryOrders } from '../../services/api';
import { formatDate, formatTime } from '../../utils/helpers';

export default function DriverHistoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const colors = useTheme();
  const [driver, setDriver] = useState<any>(null);
  const [truck, setTruck] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    console.log('[DriverHistory] Fetching data for driver:', id, name);
    Promise.all([fetchDrivers(), fetchVehicles(), fetchDeliveryOrders()]).then(([drivers, vehicles, deliveries]) => {
      console.log('[DriverHistory] Loaded drivers:', drivers.length, 'vehicles:', vehicles.length, 'deliveries:', deliveries.length);
      const foundDriver = drivers.find(d => d.id === id);
      setDriver(foundDriver || null);
      if (foundDriver?.assignedTruckId) {
        const foundTruck = vehicles.find(t => t.id === foundDriver.assignedTruckId);
        setTruck(foundTruck || null);
      }
      const driverTrips = deliveries
        .filter((d: any) => d.driverId === id)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTrips(driverTrips);
      console.log('[DriverHistory] Found', driverTrips.length, 'trips for driver');
    }).catch(err => console.error('[DriverHistory] Failed to load data:', err));
  }, [id, name]);

  const driverName = driver?.name || name || 'Driver';

  const getCompanyName = (vendorId?: string) => {
    if (!vendorId) return '';
    return vendorId;
  };

  // Group trips by date for chat-style grouping
  const groupedTrips: Record<string, typeof trips> = {};
  trips.forEach(trip => {
    const dateKey = formatDate(trip.createdAt);
    if (!groupedTrips[dateKey]) groupedTrips[dateKey] = [];
    groupedTrips[dateKey].push(trip);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Chat Header */}
      <View style={[styles.chatHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.chatAvatar, { backgroundColor: colors.accent + '15' }]}>
          <Text style={[styles.chatAvatarText, { color: colors.accent }]}>
            {driverName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </Text>
        </View>
        <View style={styles.chatHeaderInfo}>
          <Text style={[styles.chatName, { color: colors.text }]}>{driverName}</Text>
          <Text style={[styles.chatStatus, { color: colors.textSecondary }]}>
            {driver?.status === 'active' ? 'Active' : driver?.status || ''} · {truck?.plateNumber || truck?.plate || 'No truck'}
          </Text>
        </View>
      </View>

      {/* Chat Messages */}
      <FlatList
        data={Object.entries(groupedTrips).reverse()}
        keyExtractor={([date]) => date}
        contentContainerStyle={styles.chatContainer}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No trip history for {driverName}
            </Text>
          </View>
        }
        renderItem={({ item: [dateKey, dateTrips] }) => (
          <View style={styles.dateGroup}>
            {/* Date Separator */}
            <View style={styles.dateSeparator}>
              <View style={[styles.dateBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>{dateKey}</Text>
              </View>
            </View>

            {/* Messages (Trips) */}
            {dateTrips.map((trip, index) => {
              const isLast = index === dateTrips.length - 1;
              const isDelivered = trip.status === 'delivered';
              const hasMeta = trip.quarryName || trip.siteName;

              return (
                <TouchableOpacity
                  key={trip.id || trip.jobId}
                  style={[
                    styles.messageBubble,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                      marginBottom: isLast ? 8 : 4,
                    },
                  ]}
                  onPress={() => router.push(`/screens/job-details?id=${trip.jobId}`)}
                  activeOpacity={0.7}
                >
                  {/* Trip Header */}
                  <View style={styles.bubbleHeader}>
                    <Text style={[styles.tripId, { color: colors.accent }]}>{trip.jobId}</Text>
                    {(trip.netWeight || trip.weighOutWeight) && (
                      <Text style={[styles.tripWeight, { color: colors.textSecondary }]}>
                        {(trip.netWeight || trip.weighOutWeight)?.toFixed(1)}T
                      </Text>
                    )}
                  </View>

                  {/* Material & Route */}
                  <Text style={[styles.tripMaterial, { color: colors.text }]}>
                    {trip.materialName || trip.material}
                  </Text>
                  {hasMeta && (
                    <Text style={[styles.tripRoute, { color: colors.textMuted }]}>
                      {trip.quarryName} → {trip.siteName}
                    </Text>
                  )}

                  {/* Bottom row: time + status */}
                  <View style={styles.bubbleFooter}>
                    <Text style={[styles.tripTime, { color: colors.textMuted }]}>
                      {formatTime(trip.createdAt)}
                    </Text>
                    <View style={styles.statusIcons}>
                      {isDelivered ? (
                        <>
                          <Ionicons name="checkmark" size={12} color="#53BDEB" />
                          <Ionicons name="checkmark" size={12} color="#53BDEB" style={{ marginLeft: -4 }} />
                        </>
                      ) : (
                        <Ionicons name="time-outline" size={12} color="#8696BB" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />

      {/* Quick Info Footer */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.footerInfo}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>
            {driver?.phone || ''} · Lic: {driver?.licenseNumber || ''}
          </Text>
          <Text style={[styles.footerCompany, { color: colors.textMuted }]}>
            {getCompanyName(driver?.vendorId)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  backBtn: { padding: 4 },
  chatAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarText: { fontSize: 14, fontWeight: '700' },
  chatHeaderInfo: { flex: 1 },
  chatName: { fontSize: 16, fontWeight: '700' },
  chatStatus: { fontSize: 12, marginTop: 1 },
  chatContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: 80,
  },
  dateGroup: { marginBottom: Spacing.xs },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  dateBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  dateText: { fontSize: 11, fontWeight: '600' },
  messageBubble: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginLeft: Spacing.xl,
    borderTopLeftRadius: 4,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripId: { fontSize: 13, fontWeight: '700' },
  tripWeight: { fontSize: 14, fontWeight: '700' },
  tripMaterial: { fontSize: 14, marginBottom: 2 },
  tripRoute: { fontSize: 11, marginBottom: 4 },
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  tripTime: { fontSize: 11 },
  statusIcons: { flexDirection: 'row', alignItems: 'center' },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerInfo: { alignItems: 'center', gap: 2 },
  footerLabel: { fontSize: 12 },
  footerCompany: { fontSize: 11 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, marginTop: Spacing.md, textAlign: 'center' },
});