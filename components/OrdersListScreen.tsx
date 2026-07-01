import { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
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
import { fetchDeliveryOrders, fetchPurchaseOrders, fetchMaterials } from '../services/api';
import { formatEAT } from '../utils/helpers';

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

export default function OrdersListScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [matDropdownOpen, setMatDropdownOpen] = useState(false);
  const [matSearch, setMatSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [orderData, deliveryData, matData] = await Promise.all([
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
        fetchMaterials(),
      ]);
      setOrders(orderData || []);
      setDeliveries(deliveryData || []);
      setMaterials(matData || []);
    } catch (e) {
      console.error('Failed to load orders:', e);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const materialOptions = [{ id: '', name: 'All Materials' }, ...materials.map((m: any) => ({ id: m.id, name: m.name || m.id }))];
  const matFiltered = matSearch.trim()
    ? materialOptions.filter(m => (m.name || '').toLowerCase().includes(matSearch.toLowerCase()))
    : materialOptions;

  const selectedMaterial = materialOptions.find(m => m.id === materialFilter);
  const selectedStatus = STATUS_OPTIONS.find(s => s.key === filter);

  const filtered = orders.filter((order) => {
    const s = search.toLowerCase();
    const matchesSearch = !search ||
      (order.poNumber || '').toLowerCase().includes(s) ||
      (order.vendorName || '').toLowerCase().includes(s) ||
      (order.materialName || '').toLowerCase().includes(s);
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesMaterial = !materialFilter || order.materialId === materialFilter;
    return matchesSearch && matchesFilter && matchesMaterial;
  });

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

      {/* Status Dropdown Filter */}
      <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }}>
        <TouchableOpacity
          style={[styles.dropdownBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setStatusDropdownOpen(!statusDropdownOpen)}
        >
          <Ionicons name="filter-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.dropdownBtnText, { color: colors.text }]} numberOfLines={1}>
            Status: {selectedStatus ? selectedStatus.label : 'All'}
          </Text>
          <Ionicons name={statusDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {statusDropdownOpen && (
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.dropdownItem, opt.key === filter && { backgroundColor: colors.accent + '15' }]}
                  onPress={() => { setFilter(opt.key); setStatusDropdownOpen(false); }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{opt.label}</Text>
                  {opt.key === filter && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Material Dropdown Filter */}
      <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm }}>
        <TouchableOpacity
          style={[styles.dropdownBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => { setMatDropdownOpen(!matDropdownOpen); setMatSearch(''); }}
        >
          <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.dropdownBtnText, { color: selectedMaterial?.id ? colors.text : colors.textMuted }]} numberOfLines={1}>
            {selectedMaterial?.id ? selectedMaterial.name : 'Filter by material...'}
          </Text>
          {materialFilter ? (
            <TouchableOpacity onPress={() => setMaterialFilter('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <Ionicons name={matDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          )}
        </TouchableOpacity>
        {matDropdownOpen && (
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.matSearchRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="search" size={14} color={colors.textMuted} />
              <TextInput style={[styles.matSearchInput, { color: colors.text }]} placeholder="Search materials..." placeholderTextColor={colors.textMuted} value={matSearch} onChangeText={setMatSearch} autoFocus />
            </View>
            <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
              {matFiltered.map((m: any) => (
                <TouchableOpacity key={m.id} style={[styles.dropdownItem, m.id === materialFilter && { backgroundColor: colors.accent + '15' }]} onPress={() => { setMaterialFilter(m.id || ''); setMatDropdownOpen(false); }}>
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{m.name}</Text>
                  {m.id === materialFilter && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

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
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.materialName} - {item.quantity} {item.unit}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>Created: {formatEAT(item.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <ProgressStat label="Quantity" value={`${item.quantity} ${item.unit}`} color={colors.text} />
        <ProgressStat label="Trips" value={orderTrips.length.toString()} color={colors.text} />
      </View>

      {orderTrips.length > 0 && (
        <View style={[styles.tripList, { borderTopColor: colors.borderLight }]}>
          {orderTrips.slice(0, 3).map((trip) => (
            <View key={trip.id} style={styles.tripRow}>
              <Text style={[styles.tripText, { color: colors.text }]} numberOfLines={1}>{trip.driverName}</Text>
              <Text style={[styles.tripText, { color: colors.textSecondary }]} numberOfLines={1}>{trip.plateNumber}</Text>
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
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: 6 },
  dropdownBtnText: { flex: 1, fontSize: 14 },
  dropdownMenu: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: Spacing.md },
  matSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
  matSearchInput: { flex: 1, fontSize: 13, paddingVertical: 2 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['4xl'] },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  orderTitleWrap: { flex: 1 },
  orderPo: { fontSize: 14, fontWeight: '700' },
  vendorName: { fontSize: 12, marginTop: 2 },
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
  moreTrips: { fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});