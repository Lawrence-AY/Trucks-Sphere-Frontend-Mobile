import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchPurchaseOrders } from '../../services/api';
import { formatCurrency, formatEAT, getStatusColor, formatStatus } from '../../utils/helpers';

export default function OrdersScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = await fetchPurchaseOrders();
      setOrders(data || []);
    } catch (e) {
      console.error('Failed to load orders:', e);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = orders.filter((o) => {
    const s = search.toLowerCase();
    const matchesSearch = !search ||
      (o.poNumber || '').toLowerCase().includes(s) ||
      (o.vendorName || '').toLowerCase().includes(s) ||
      (o.materialName || '').toLowerCase().includes(s);
    const f = filter === 'all' || o.status === filter;
    return matchesSearch && f;
  });

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by Purchase Order, vendor..."
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
        horizontal
        data={filters}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              { borderColor: colors.border },
              filter === item.key && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === item.key && { color: '#FFF' },
            ]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No orders found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/screens/purchase-order?id=${item.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.orderPo, { color: colors.text }]}>{item.poNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {formatStatus(item.status).toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.detailRow}>
                <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.vendorName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.materialName} — {item.quantity} {item.unit}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>{formatCurrency(item.totalAmount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>Created: {formatEAT(item.createdAt)}</Text>
              </View>
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
  filterRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['4xl'] },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  orderPo: { fontSize: 14, fontWeight: '700' },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardBody: { gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  detailText: { fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});
