import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchVendors, fetchDrivers } from '../../services/api';

export default function VendorsScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchVendors();
      setVendors(data || []);
    } catch (e) {
      console.error('Failed to load vendors:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const [drivers, setDrivers] = useState<any[]>([]);
  useEffect(() => {
    fetchDrivers().then(d => setDrivers(d || [])).catch(() => {});
  }, []);

  const filtered = vendors.filter(v =>
    v.name?.toLowerCase().includes((search || '').toLowerCase())
  );

  const getDriverCount = (vendorId: string) =>
    drivers.filter((d: any) => d.vendorId === vendorId).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search vendors..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No vendors found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.avatar, { backgroundColor: colors.accent + '15' }]}>
                <Text style={[styles.avatarText, { color: colors.accent }]}>
                  {(item.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.cardPhone, { color: colors.textSecondary }]}>{item.phone}</Text>
              </View>
            </View>
            <View style={styles.cardRight}>
              <Text style={[styles.fleetStat, { color: colors.text }]}>
                {getDriverCount(item.id)} drivers
              </Text>
              <View style={[
                styles.statusDot,
                { backgroundColor: item.status === 'active' ? '#16A34A' : '#94A3B8' },
              ]} />
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
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing['4xl'] },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600' },
  cardPhone: { fontSize: 13, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  fleetStat: { fontSize: 13, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});
