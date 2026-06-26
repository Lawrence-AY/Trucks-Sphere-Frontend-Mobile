import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT, getStatusColor, formatStatus } from '../../utils/helpers';

export default function HistoryScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      const data = await fetchDeliveryOrders();
      setDeliveries(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const completed = deliveries
    .filter((d) => d.status === 'delivered')
    .filter((d) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (d.jobId || '').toLowerCase().includes(q) ||
        (d.driverName || '').toLowerCase().includes(q) ||
        (d.plateNumber || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  const renderItem = ({ item }: { item: any }) => {
    const netWt = item.netWeight || (item.weighInWeight && item.weighOutWeight
      ? (item.weighInWeight - item.weighOutWeight).toFixed(1) : null);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={() => router.push(`/screens/delivery-note?id=${item.jobId}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={[styles.cardIcon, { backgroundColor: '#10B98112' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
            <Text style={[styles.plate, { color: colors.textSecondary }]}>{item.plateNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: '#10B98115' }]}>
            <Text style={[styles.statusText, { color: '#10B981' }]}>DONE</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>{item.driverName}</Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="cube-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>{item.materialName}</Text>
          </View>
          {netWt && (
            <View style={styles.cardRow}>
              <Ionicons name="speedometer-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>Net: {netWt} t</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardTime, { color: colors.textTertiary }]}>
          {formatEAT(item.updatedAt || item.createdAt)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search completed deliveries..."
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
        data={completed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: '#10B98110' }]}>
                <Ionicons name="time-outline" size={40} color="#10B981" />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No completed deliveries</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Completed deliveries will appear here
              </Text>
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
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  jobId: { fontSize: 14, fontWeight: '700' },
  plate: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardBody: { gap: 5, marginTop: Spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardText: { fontSize: 13 },
  cardTime: { fontSize: 11, marginTop: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
});
