import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { MOCK_TRUCKS } from '../../store/mockData';

export default function TrucksScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = MOCK_TRUCKS.filter((t) =>
    (t.plate || t.plateNumber || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (t.model || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by plate or model..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No trucks found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/screens/truck-history?id=${item.id}&plate=${encodeURIComponent(item.plate || item.plateNumber)}`)}
          >
            <View style={styles.cardTop}>
              <View style={[styles.plateBadge, { backgroundColor: colors.accent + '15' }]}>
                <Text style={[styles.plateText, { color: colors.accent }]}>{item.plate || item.plateNumber}</Text>
              </View>
              <StatusBadge status={item.status} colors={colors} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.modelText, { color: colors.text }]}>{item.model}</Text>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>Driver: {item.driverName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>Vendor: {item.vendorName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="hardware-chip-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>Axles: {item.axles} | Capacity: {item.capacity}T</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const StatusBadge = ({ status, colors: c }: { status: string; colors: any }) => {
  const config: Record<string, { color: string; label: string }> = {
    active: { color: '#16A34A', label: 'Active' },
    loading: { color: '#2563EB', label: 'Loading' },
    in_transit: { color: '#D97706', label: 'In Transit' },
    maintenance: { color: '#DC2626', label: 'Maintenance' },
    idle: { color: '#64748B', label: 'Idle' },
  };
  const s = config[status] || { color: '#64748B', label: status };
  return (
    <View style={[styles.badge, { backgroundColor: s.color + '15' }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing['4xl'] },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  plateBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  plateText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  cardBody: { gap: 6 },
  modelText: { fontSize: 15, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  detailText: { fontSize: 13 },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});
