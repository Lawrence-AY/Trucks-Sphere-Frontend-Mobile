import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { MOCK_TRUCKS, MOCK_WEIGHMENTS } from '../../store/mockData';

export default function TruckHistoryScreen() {
  const { id, plate } = useLocalSearchParams<{ id: string; plate: string }>();
  const colors = useTheme();

  const truck = MOCK_TRUCKS.find(t => t.id === id);
  const trips = MOCK_WEIGHMENTS.filter(w => w.truckPlate === (truck?.plate || truck?.plateNumber || plate));

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
              <Text style={[styles.profileDetail, { color: colors.textSecondary }]}>Driver: {truck.driverName}</Text>
              <Text style={[styles.profileDetail, { color: colors.textTertiary }]}>Vendor: {truck.vendorName}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(truck.status) }]}>
              <Text style={[styles.statusText, { color: getStatusColor(truck.status) }]}>
                {truck.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{truck.axles}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Axles</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{truck.capacity}T</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Capacity</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{trips.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
            </View>
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Weighment History</Text>
      {trips.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="car-outline" size={40} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No weighments recorded</Text>
        </View>
      ) : (
        trips.map((trip, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/screens/weigh-receipt?id=${trip.id}`)}
          >
            <View style={styles.tripTop}>
              <Text style={[styles.tripJob, { color: colors.accent }]}>{trip.id}</Text>
              <Text style={[styles.tripStatus, { color: trip.status === 'completed' ? '#16A34A' : '#2563EB' }]}>
                {(trip.status || trip.type).replace('_', ' ')}
              </Text>
            </View>
            <View style={styles.tripRow}>
              <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.tripText, { color: colors.textSecondary }]}>{trip.driverName}</Text>
            </View>
            <View style={styles.tripRow}>
              <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.tripText, { color: colors.textSecondary }]}>{trip.material}</Text>
            </View>
            {trip.weightIn && (
              <View style={styles.tripRow}>
                <Ionicons name="scale-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.tripText, { color: colors.textSecondary }]}>Gross: {trip.weightIn.toFixed(1)}T</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function getStatusBg(s: string): string {
  const m: Record<string, string> = { active: '#DCFCE7', loading: '#DBEAFE', in_transit: '#FEF3C7', maintenance: '#FEE2E2', idle: '#F1F5F9' };
  return m[s] || '#F1F5F9';
}
function getStatusColor(s: string): string {
  const m: Record<string, string> = { active: '#16A34A', loading: '#2563EB', in_transit: '#D97706', maintenance: '#DC2626', idle: '#64748B' };
  return m[s] || '#64748B';
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
  profileDetail: { fontSize: 13, marginTop: 1 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '700' },
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
  tripText: { fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});
