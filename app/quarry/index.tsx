import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchWeighments } from '../../services/api';
import { useState, useEffect } from 'react';

export default function QuarryScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [weighments, setWeighments] = useState<any[]>([]);

  useEffect(() => {
    console.log('[QuarryScreen] Fetching weighments from backend...');
    fetchWeighments().then(data => {
      console.log('[QuarryScreen] Weighments loaded:', data.length, 'items', data);
      setWeighments(data);
    }).catch(err => console.error('[QuarryScreen] Failed to load weighments:', err));
  }, []);

  const allRecords = [...weighments];
  const filtered = allRecords.filter(w =>
    (w.truckPlate || w.plateNumber || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (w.driverName || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (w.id || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/quarry/weigh-in')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#2563EB15' }]}>
            <Ionicons name="arrow-down-circle" size={28} color="#2563EB" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Weigh In</Text>
          <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Gross weight</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/quarry/weigh-out')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#D9770615' }]}>
            <Ionicons name="arrow-up-circle" size={28} color="#D97706" />
          </View>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Weigh Out</Text>
          <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Tare + net</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search records..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/screens/weigh-receipt?id=${item.id}`)}
          >
            <View style={styles.recordTop}>
              <Text style={[styles.recordPlate, { color: colors.accent }]}>{item.truckPlate || item.plateNumber}</Text>
              <StatusBadge status={item.status || 'pending'} />
            </View>
            <View style={styles.recordRow}>
              <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.recordText, { color: colors.textSecondary }]}>{item.driverName}</Text>
            </View>
            <View style={styles.recordRow}>
              <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.recordText, { color: colors.textSecondary }]}>{item.material || item.materialName} | {item.weightIn?.toFixed(1)}T</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { color: string; label: string }> = {
    pending: { color: '#D97706', label: 'Pending' },
    weighed_in: { color: '#2563EB', label: 'Weighed In' },
    completed: { color: '#16A34A', label: 'Completed' },
  };
  const s = styles[status] || { color: '#64748B', label: status };
  return (
    <View style={[badgeStyles.badge, { backgroundColor: s.color + '15' }]}>
      <Text style={[badgeStyles.text, { color: s.color }]}>{s.label}</Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  text: { fontSize: 10, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  actionGrid: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg },
  actionCard: {
    flex: 1, borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.lg, alignItems: 'center',
  },
  actionIcon: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  actionLabel: { fontSize: 15, fontWeight: '700' },
  actionSub: { fontSize: 11, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, borderRadius: Radius.md,
    borderWidth: 1, paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  recordCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm },
  recordTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  recordPlate: { fontSize: 15, fontWeight: '700' },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 4 },
  recordText: { fontSize: 13 },
});