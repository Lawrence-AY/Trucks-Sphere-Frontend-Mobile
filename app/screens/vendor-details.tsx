import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders, fetchDrivers, fetchPurchaseOrders, fetchVehicles, fetchVendors } from '../../services/api';
import { formatCurrency, formatStatus, getStatusColor } from '../../utils/helpers';

export default function VendorDetailsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorOrdersCount, setVendorOrdersCount] = useState<Record<string, number>>({});
  const [vendorDriversCount, setVendorDriversCount] = useState<Record<string, number>>({});

  const isListView = !id;
  const isWeb = Platform.OS === 'web';
  const isLargeScreen = width >= 768;
  const cardWidth = isWeb && isLargeScreen ? `${100 / 3}%` as const : isWeb ? '49%' as const : '100%' as const;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vendorData, orderData, deliveryData, driverData, truckData] = await Promise.all([
        fetchVendors(),
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
        fetchDrivers(),
        fetchVehicles(),
      ]);

      if (id) {
        setVendor(vendorData.find((v: any) => v.id === id) || { id, name });
        setOrders((orderData || []).filter((order: any) => order.vendorId === id));
        setDeliveries((deliveryData || []).filter((delivery: any) => delivery.vendorId === id));
        setDrivers((driverData || []).filter((driver: any) => driver.vendorId === id));
        setTrucks((truckData || []).filter((truck: any) => truck.vendorId === id));
      } else {
        // Build counts for the vendor list
        const ordersCount: Record<string, number> = {};
        const driversCount: Record<string, number> = {};
        (orderData || []).forEach((o: any) => {
          if (o.vendorId) ordersCount[o.vendorId] = (ordersCount[o.vendorId] || 0) + 1;
        });
        (driverData || []).forEach((d: any) => {
          if (d.vendorId) driversCount[d.vendorId] = (driversCount[d.vendorId] || 0) + 1;
        });
        setAllVendors(vendorData || []);
        setVendorOrdersCount(ordersCount);
        setVendorDriversCount(driversCount);
      }
    } catch (e) {
      console.error('Failed to load vendor details:', e);
    }
    setLoading(false);
  }, [id, name]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return allVendors;
    const q = vendorSearch.toLowerCase();
    return allVendors.filter((v: any) =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.phone || '').toLowerCase().includes(q)
    );
  }, [allVendors, vendorSearch]);

  const totals = useMemo(() => {
    const ordered = orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
    const transported = deliveries.reduce((sum, delivery) => sum + Number(delivery.quantityDelivered || 0), 0);
    return {
      ordered,
      transported,
      remaining: Math.max(0, ordered - transported),
    };
  }, [orders, deliveries]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading vendors...</Text>
      </View>
    );
  }

  // ===== VENDOR LIST VIEW (no id param) =====
  if (isListView) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: colors.text }]}>Vendors</Text>
          <Text style={[styles.listSubtitle, { color: colors.textSecondary }]}>
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search vendors by name, email, phone..."
            placeholderTextColor={colors.textMuted}
            value={vendorSearch}
            onChangeText={setVendorSearch}
          />
          {vendorSearch.length > 0 && (
            <TouchableOpacity onPress={() => setVendorSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {filteredVendors.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {vendorSearch ? 'No vendors match your search' : 'No vendors found'}
            </Text>
          </View>
        ) : (
          <View style={[styles.vendorGrid, { gap: Spacing.md }]}>
            {filteredVendors.map((v: any) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.vendorCard, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  width: cardWidth,
                }]}
                onPress={() => router.push(`/screens/vendor-details?id=${v.id}&name=${encodeURIComponent(v.name || '')}`)}
                activeOpacity={0.85}
              >
                <View style={styles.vendorCardTop}>
                  <View style={[styles.vendorCardAvatar, { backgroundColor: colors.accent + '15' }]}>
                    <Text style={[styles.vendorCardAvatarText, { color: colors.accent }]}>
                      {(v.name || 'V').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.vendorCardInfo}>
                    <Text style={[styles.vendorCardName, { color: colors.text }]} numberOfLines={1}>{v.name}</Text>
                    {v.phone && (
                      <Text style={[styles.vendorCardMeta, { color: colors.textSecondary }]}>
                        <Ionicons name="call-outline" size={11} color={colors.textSecondary} /> {v.phone}
                      </Text>
                    )}
                    {v.email && (
                      <Text style={[styles.vendorCardMeta, { color: colors.textSecondary }]}>
                        <Ionicons name="mail-outline" size={11} color={colors.textSecondary} /> {v.email}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
                <View style={[styles.vendorCardStats, { borderTopColor: colors.borderLight || colors.border }]}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{vendorOrdersCount[v.id] || 0}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>POs</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{vendorDriversCount[v.id] || 0}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Drivers</Text>
                  </View>
                  {v.status && (
                    <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(v.status) + '18' }]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusColor(v.status) }]}>
                        {formatStatus(v.status)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  // ===== SINGLE VENDOR DETAIL VIEW (with id param) =====
  const vendorName = vendor?.name || name || 'Vendor';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent + '15' }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>
            {vendorName.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.vendorName, { color: colors.text }]}>{vendorName}</Text>
          <Text style={[styles.vendorMeta, { color: colors.textSecondary }]}>{vendor?.phone || 'No phone'} · {vendor?.email || 'No email'}</Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryTile label="Purchase Orders" value={orders.length} icon="document-text-outline" />
        <SummaryTile label="Drivers" value={drivers.length} icon="people-outline" />
        <SummaryTile label="Trucks" value={trucks.length} icon="car-outline" />
        <SummaryTile label="Remaining" value={totals.remaining} suffix={orders[0]?.unit || 'tonnes'} icon="cube-outline" />
      </View>

      <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Transport Summary</Text>
        <View style={styles.progressRow}>
          <Metric label="Ordered" value={`${totals.ordered} ${orders[0]?.unit || ''}`} />
          <Metric label="Transported" value={`${totals.transported} ${orders[0]?.unit || ''}`} accent />
          <Metric label="Remaining" value={`${totals.remaining} ${orders[0]?.unit || ''}`} warning={totals.remaining > 0} />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Drivers</Text>
      <FlatList
        horizontal
        data={drivers}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        ListEmptyComponent={<Text style={[styles.emptyInline, { color: colors.textMuted }]}>No drivers found</Text>}
        renderItem={({ item }) => (
          <View style={[styles.personCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.itemTitle, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>{item.phone}</Text>
            <Text style={[styles.itemMeta, { color: colors.textMuted }]}>Lic: {item.licenseNumber}</Text>
          </View>
        )}
      />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Trucks</Text>
      <FlatList
        horizontal
        data={trucks}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        ListEmptyComponent={<Text style={[styles.emptyInline, { color: colors.textMuted }]}>No trucks found</Text>}
        renderItem={({ item }) => (
          <View style={[styles.truckCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.itemTitle, { color: colors.text }]}>{item.plateNumber}</Text>
            <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>{item.make} {item.model}</Text>
            <Text style={[styles.itemMeta, { color: colors.textMuted }]}>{item.capacity} tonnes · {formatStatus(item.status)}</Text>
          </View>
        )}
      />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Purchase Orders</Text>
      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={44} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No purchase orders found</Text>
        </View>
      ) : (
        orders.map((order) => {
          const orderTrips = deliveries.filter((delivery) => delivery.purchaseOrderId === order.id);
          const transported = orderTrips.reduce((sum, delivery) => sum + Number(delivery.quantityDelivered || 0), 0);
          const remaining = Math.max(0, Number(order.quantity || 0) - transported);
          return (
            <TouchableOpacity
              key={order.id}
              style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/screens/purchase-order?id=${order.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.orderTop}>
                <View>
                  <Text style={[styles.poNumber, { color: colors.text }]}>{order.poNumber}</Text>
                  <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>{order.materialName} · {order.quantity} {order.unit}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: getStatusColor(order.status) + '15' }]}>
                  <Text style={[styles.badgeText, { color: getStatusColor(order.status) }]}>{formatStatus(order.status)}</Text>
                </View>
              </View>
              <View style={styles.orderMetrics}>
                <Metric label="Ordered" value={`${order.quantity} ${order.unit}`} />
                <Metric label="Transported" value={`${transported} ${order.unit}`} accent />
                <Metric label="Remaining" value={`${remaining} ${order.unit}`} warning={remaining > 0} />
              </View>
              {orderTrips.map((trip) => (
                <View key={trip.id} style={[styles.tripRow, { borderTopColor: colors.borderLight }]}>
                  <Text style={[styles.tripText, { color: colors.text }]}>{trip.driverName}</Text>
                  <Text style={[styles.tripText, { color: colors.textSecondary }]}>{trip.plateNumber}</Text>
                  <Text style={[styles.tripQty, { color: colors.accent }]}>{trip.quantityDelivered || 0} {order.unit}</Text>
                </View>
              ))}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const SummaryTile = ({ label, value, suffix, icon }: { label: string; value: string | number; suffix?: string; icon: keyof typeof Ionicons.glyphMap }) => {
  const colors = useTheme();
  return (
    <View style={[styles.summaryTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}{suffix ? ` (${suffix})` : ''}</Text>
    </View>
  );
};

const Metric = ({ label, value, accent, warning }: { label: string; value: string; accent?: boolean; warning?: boolean }) => {
  const colors = useTheme();
  const valueColor = accent ? '#16A34A' : warning ? '#D97706' : colors.text;
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, marginTop: Spacing.md },
  // List View
  listHeader: { marginBottom: Spacing.lg },
  listTitle: { fontSize: 24, fontWeight: '900' },
  listSubtitle: { fontSize: 13, marginTop: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'web' ? Spacing.sm : Spacing.md,
    marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  vendorGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  vendorCard: {
    borderWidth: 1, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.sm,
  },
  vendorCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  vendorCardAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  vendorCardAvatarText: { fontSize: 18, fontWeight: '800' },
  vendorCardInfo: { flex: 1 },
  vendorCardName: { fontSize: 15, fontWeight: '800' },
  vendorCardMeta: { fontSize: 12, marginTop: 2 },
  vendorCardStats: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, gap: Spacing.lg },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 1 },
  statusBadgeSmall: { marginLeft: 'auto', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  // Detail View
  headerCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.md },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  headerInfo: { flex: 1 },
  vendorName: { fontSize: 18, fontWeight: '800' },
  vendorMeta: { fontSize: 12, marginTop: 3 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  summaryTile: { width: '48.5%', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  summaryValue: { fontSize: 18, fontWeight: '800', marginTop: Spacing.xs },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  progressCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: Spacing.md, marginTop: Spacing.sm },
  horizontalList: { gap: Spacing.sm, paddingBottom: Spacing.md },
  personCard: { width: 170, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  truckCard: { width: 180, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  itemMeta: { fontSize: 12, marginTop: 3 },
  emptyInline: { fontSize: 13, paddingVertical: Spacing.md },
  empty: { alignItems: 'center', paddingVertical: Spacing['3xl'] },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
  orderCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.md },
  poNumber: { fontSize: 15, fontWeight: '800' },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  orderMetrics: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.sm },
  metric: { flex: 1 },
  metricLabel: { fontSize: 10 },
  metricValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  tripRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: Spacing.sm, marginTop: Spacing.sm, gap: Spacing.sm },
  tripText: { flex: 1, fontSize: 12 },
  tripQty: { fontSize: 12, fontWeight: '800' },
});