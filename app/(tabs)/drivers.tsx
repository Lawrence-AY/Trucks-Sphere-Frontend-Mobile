import { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { fetchDrivers } from '../../services/api';
import { formatStatus, getStatusColor } from '../../utils/helpers';

export default function DriversScreen() {
  const colors = useTheme();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      const data = await fetchDrivers();
      setDrivers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filtered = drivers.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (d.name || '').toLowerCase().includes(q) ||
      (d.phone || '').includes(q) ||
      (d.licenseNumber || '').toLowerCase().includes(q)
    );
  });

  const renderItem = ({ item }: { item: any }) => {
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }]}
        activeOpacity={0.7}
        onPress={() => router.push(`/screens/driver-history?id=${item.id}&name=${encodeURIComponent(item.name || 'Driver')}`)}
      >
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: '#10B98115' }]}>
            <Text style={[styles.avatarText, { color: '#10B981' }]}>
              {item.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'D'}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.phone, { color: colors.textSecondary }]}>{item.phone}</Text>
            <Text style={[styles.license, { color: colors.textSecondary }]}>
              License: {item.licenseNumber}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {formatStatus(item.status).toUpperCase()}
            </Text>
          </View>
        </View>
        {item.totalTrips !== undefined && (
          <View style={styles.cardFooter}>
            <Ionicons name="navigate-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.tripText, { color: colors.textSecondary }]}>
              {item.totalTrips} trip{item.totalTrips !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search drivers..."
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: '#10B98110' }]}>
                <Ionicons name="people-outline" size={40} color="#10B981" />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No drivers found</Text>
            </View>
          ) : null
        }
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
  list: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700' },
  phone: { fontSize: 13, marginTop: 1 },
  license: { fontSize: 12, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  tripText: { fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '600' },
});
