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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing } from '../constants/theme';
import { fetchDeliveryOrders, fetchPurchaseOrders } from '../services/api';
import { formatCurrency, formatEAT, formatStatus, getStatusColor } from '../utils/helpers';

export default function OrdersListScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [orderData, deliveryData] = await Promise.all([
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
      ]);
      setOrders(orderData || []);
      setDeliveries(deliveryData || []);
    } catch (e) {
      console.error('Failed to load orders:', e);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = orders.filter((order) => {
    const s = search.toLowerCase();
    const matchesSearch = !search ||
      (order.poNumber || '').toLowerCase().includes(s) ||
      (order.vendorName || '').toLowerCase().includes(s) ||
      (order.materialName || '').toLowerCase().includes(s);
    return matchesSearch && (filter === 'all' || order.status === filter);
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
        keyExtractor={(item) => item.key}
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
          <OrderCard item={item} deliveries={deliveries} />
        )}
      />
    </View>
  );
}

const OrderCard = ({ item, deliveries }: { item: any; deliveries: any[] }) => {
  const colors = useTheme();
  const orderTrips = deliveries.filter((delivery) => delivery.purchaseOrderId === item.id);
  const transported = orderTrips.reduce((sum, delivery) => sum + Number(delivery.quantityDelivered || 0), 0);
  const remaining = Math.max(0, Number(item.quantity || 0) - transported);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/screens/purchase-order?id=${item.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <View style={styles.orderTitleWrap}>
          <Text style={[styles.orderPo, { color: colors.text }]}>{item.poNumber}</Text>
          <Text style={[styles.vendorName, { color: colors.textSecondary }]}>{item.vendorName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {formatStatus(item.status).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.materialName} - {item.quantity} {item.unit}</Text>
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

      <View style={styles.progressRow}>
        <ProgressStat label="Transported" value={`${transported} ${item.unit}`} color="#16A34A" />
        <ProgressStat label="Remaining" value={`${remaining} ${item.unit}`} color={remaining > 0 ? '#D97706' : '#16A34A'} />
        <ProgressStat label="Trips" value={orderTrips.length.toString()} color={colors.text} />
      </View>

      {orderTrips.length > 0 && (
        <View style={[styles.tripList, { borderTopColor: colors.borderLight }]}>
          {orderTrips.slice(0, 3).map((trip) => (
            <View key={trip.id} style={styles.tripRow}>
              <Text style={[styles.tripText, { color: colors.text }]} numberOfLines={1}>{trip.driverName}</Text>
              <Text style={[styles.tripText, { color: colors.textSecondary }]} numberOfLines={1}>{trip.plateNumber}</Text>
              <Text style={[styles.tripQty, { color: colors.accent }]}>{trip.quantityDelivered || 0} {item.unit}</Text>
            </View>
          ))}
          {orderTrips.length > 3 && (
            <Text style={[styles.moreTrips, { color: colors.textMuted }]}>+{orderTrips.length - 3} more trips</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const ProgressStat = ({ label, value, color }: { label: string; value: string; color: string }) => {
  const colors = useTheme();
  return (
    <View style={styles.progressStatBox}>
      <Text style={[styles.progressLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.progressValue, { color }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterRow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['4xl'] },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  orderTitleWrap: { flex: 1 },
  orderPo: { fontSize: 14, fontWeight: '700' },
  vendorName: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardBody: { gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  detailText: { fontSize: 13 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, marginTop: Spacing.md },
  progressStatBox: { flex: 1 },
  progressLabel: { fontSize: 10 },
  progressValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  tripList: { borderTopWidth: 1, marginTop: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.xs },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tripText: { flex: 1, fontSize: 12 },
  tripQty: { fontSize: 12, fontWeight: '800' },
  moreTrips: { fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});
