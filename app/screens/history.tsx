import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchWeighments } from '../../services/api';

export default function HistoryScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'weigh_in' | 'weigh_out'>('all');
  const [weighments, setWeighments] = useState<any[]>([]);

  useEffect(() => {
    console.log('[History] Fetching weighments from backend...');
    fetchWeighments().then(data => {
      console.log('[History] Weighments loaded:', data.length, 'items', data);
      setWeighments(data);
    }).catch(err => console.error('[History] Failed to load weighments:', err));
  }, []);

  const filtered = weighments.filter(w => {
    const matchesSearch =
      !search ||
      (w.jobId || '').toLowerCase().includes(search.toLowerCase()) ||
      (w.deliveryOrderId || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || w.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by job ID..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'weigh_in', 'weigh_out'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              { borderColor: colors.border },
              filter === f && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === f && { color: '#FFF' },
            ]}>
              {f === 'all' ? 'All' : f === 'weigh_in' ? 'Weigh In' : 'Weigh Out'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No weigh records found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/screens/weigh-receipt?id=${item.id}`)}
          >
            <View style={styles.cardTop}>
              <View style={[styles.typeBadge, {
                backgroundColor: (item.type === 'weigh_in' ? '#2563EB' : '#7C3AED') + '15',
              }]}>
                <Ionicons
                  name={item.type === 'weigh_in' ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={16}
                  color={item.type === 'weigh_in' ? '#2563EB' : '#7C3AED'}
                />
                <Text style={[styles.typeText, {
                  color: item.type === 'weigh_in' ? '#2563EB' : '#7C3AED',
                }]}>
                  {item.type === 'weigh_in' ? 'WEIGH IN' : 'WEIGH OUT'}
                </Text>
              </View>
              <Text style={[styles.weightText, { color: colors.text }]}>
                {(item.weight || item.weightIn)?.toFixed(1)}T
              </Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
              <Text style={[styles.location, { color: colors.textSecondary }]}>
                <Ionicons name="location-outline" size={12} /> {item.location}
              </Text>
              <Text style={[styles.operator, { color: colors.textMuted }]}>
                {item.operatorName}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['4xl'] },
  card: {
    borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  typeText: { fontSize: 10, fontWeight: '700' },
  weightText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { gap: 3 },
  jobId: { fontSize: 14, fontWeight: '600' },
  location: { fontSize: 12 },
  operator: { fontSize: 11 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});