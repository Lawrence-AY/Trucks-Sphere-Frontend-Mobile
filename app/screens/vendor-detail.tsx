import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchVendors, fetchPurchaseOrders, fetchDrivers, fetchVehicles, fetchDeliveryOrders } from '../../services/api';
import { formatEAT, getStatusColor, formatStatus } from '../../utils/helpers';

export default function VendorDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const colors = useTheme();
  const [vendor, setVendor] = useState<any>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [vendorsData, ordersData, driversData, trucksData, deliveriesData] = await Promise.all([
        fetchVendors(),
        fetchPurchaseOrders(),
        fetchDrivers(),
        fetchVehicles(),
        fetchDeliveryOrders(),
      ]);

      const foundVendor = vendorsData?.find((v: any) => v.id === id);
      setVendor(foundVendor || null);

      const vendorOrders = (ordersData || []).filter(
        (o: any) => o.vendorId === id || o.vendorName === name
      );
      setPurchaseOrders(vendorOrders);

      const vendorDrivers = (driversData || []).filter(
        (d: any) => d.vendorId === id
      );
      setDrivers(vendorDrivers);

      const vendorTrucks = (trucksData || []).filter(
        (t: any) => t.vendorId === id
      );
      setTrucks(vendorTrucks);

      const vendorDeliveries = (deliveriesData || []).filter(
        (d: any) => d.vendorId === id || d.vendorName === name
      );
      setDeliveries(vendorDeliveries);
    } catch (e) {
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const completedOrders = purchaseOrders.filter(o => o.status === 'completed').length;
  const activeOrders = purchaseOrders.filter(o => ['approved', 'in_progress', 'pending'].includes(o.status)).length;
  const totalDeliveries = deliveries.length;
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered' || d.status === 'completed').length;
  const totalDeliveredQty = deliveries.reduce((sum, d) => sum + (d.quantityDelivered || 0), 0);
  const totalOrderedQty = purchaseOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const remainingQty = Math.max(0, totalOrderedQty - totalDeliveredQty);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading vendor details...</Text>
      </View>
    );
  }

  const vendorName = vendor?.name || name || 'Vendor';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Vendor Header */}
      <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
        <View style={styles.headerTop}>
          <View style={[styles.vendorAvatar, { backgroundColor: '#F59E0B15' }]}>
            <Text style={styles.vendorAvatarText}>
              {vendorName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.vendorName, { color: colors.text }]}>{vendorName}</Text>
            {vendor?.phone && (
              <Text style={[styles.vendorContact, { color: colors.textSecondary }]}>
                <Ionicons name="call-outline" size={12} color={colors.textSecondary} /> {vendor.phone}
              </Text>
            )}
            {vendor?.email && (
              <Text style={[styles.vendorContact, { color: colors.textSecondary }]}>
                <Ionicons name="mail-outline" size={12} color={colors.textSecondary} /> {vendor.email}
              </Text>
            )}
          </View>
          {vendor?.status && (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(vendor.status) + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(vendor.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(vendor.status) }]}>
                {formatStatus(vendor.status).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: '#1B2A4A12' }]}>
            <Ionicons name="document-text" size={20} color="#1B2A4A" />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{purchaseOrders.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Orders</Text>
          <Text style={[styles.statSub, { color: colors.textMuted }]}>
            {activeOrders} active · {completedOrders} done
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: '#3B82F612' }]}>
            <Ionicons name="people" size={20} color="#3B82F6" />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{drivers.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Drivers</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: '#D9770612' }]}>
            <Ionicons name="car" size={20} color="#D97706" />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{trucks.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trucks</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.statIcon, { backgroundColor: '#10B98112' }]}>
            <Ionicons name="cube" size={20} color="#10B981" />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>{totalDeliveredQty}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Delivered (t)</Text>
        </View>
      </View>

      {/* Delivery Progress */}
      {totalOrderedQty > 0 && (
        <View style={[styles.progressCard, { backgroundColor: colors.surface }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Transport Progress</Text>
            <Text style={[styles.progressStat, { color: colors.textSecondary }]}>
              {completedDeliveries}/{totalDeliveries} trips
            </Text>
          </View>
          <View style={styles.progressDetails}>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Ordered</Text>
              <Text style={[styles.progressValue, { color: colors.text }]}>{totalOrderedQty} tonnes</Text>
            </View>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Delivered</Text>
              <Text style={[styles.progressValue, { color: '#16A34A' }]}>{totalDeliveredQty} tonnes</Text>
            </View>
            <View style={styles.progressDetailItem}>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Remaining</Text>
              <Text style={[styles.progressValue, { color: remainingQty > 0 ? '#D97706' : '#16A34A' }]}>{remainingQty} tonnes</Text>
            </View>
          </View>
        </View>
      )}

      {/* Purchase Orders */}
      {purchaseOrders.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Purchase Orders ({purchaseOrders.length})
          </Text>
          {purchaseOrders.map((po) => (
            <TouchableOpacity
              key={po.id}
              style={[styles.itemCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/screens/purchase-order?id=${po.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.itemTop}>
                <View style={[styles.itemIcon, { backgroundColor: getStatusColor(po.status) + '12' }]}>
                  <Ionicons name="document-text" size={16} color={getStatusColor(po.status)} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{po.poNumber}</Text>
                  <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                    {po.materialName} · {po.quantity} {po.unit}
                  </Text>
                </View>
                <View style={[styles.itemBadge, { backgroundColor: getStatusColor(po.status) + '15' }]}>
                  <Text style={[styles.itemBadgeText, { color: getStatusColor(po.status) }]}>
                    {formatStatus(po.status).toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemMetaText, { color: colors.textMuted }]}>
                  {formatEAT(po.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Drivers */}
      {drivers.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Drivers ({drivers.length})
          </Text>
          {drivers.map((driver) => (
            <TouchableOpacity
              key={driver.id}
              style={[styles.itemCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/screens/driver-history?id=${driver.id}&name=${encodeURIComponent(driver.name)}`)}
              activeOpacity={0.7}
            >
              <View style={styles.itemTop}>
                <View style={[styles.itemIcon, { backgroundColor: '#10B98112' }]}>
                  <Ionicons name="person" size={16} color="#10B981" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{driver.name}</Text>
                  <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                    {driver.phone} · Lic: {driver.licenseNumber}
                  </Text>
                </View>
                <View style={[styles.itemBadge, { backgroundColor: getStatusColor(driver.status) + '15' }]}>
                  <Text style={[styles.itemBadgeText, { color: getStatusColor(driver.status) }]}>
                    {formatStatus(driver.status).toUpperCase()}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Trucks */}
      {trucks.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Trucks ({trucks.length})
          </Text>
          {trucks.map((truck) => (
            <TouchableOpacity
              key={truck.id}
              style={[styles.itemCard, { backgroundColor: colors.surface }]}
              activeOpacity={0.7}
            >
              <View style={styles.itemTop}>
                <View style={[styles.itemIcon, { backgroundColor: '#D9770612' }]}>
                  <Ionicons name="car" size={16} color="#D97706" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{truck.plateNumber}</Text>
                  <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                    {truck.make} {truck.model} · {truck.capacity} tonnes
                  </Text>
                </View>
                <View style={[styles.itemBadge, { backgroundColor: getStatusColor(truck.status) + '15' }]}>
                  <Text style={[styles.itemBadgeText, { color: getStatusColor(truck.status) }]}>
                    {formatStatus(truck.status).toUpperCase()}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
        <Text style={[styles.backText, { color: colors.textSecondary }]}>Back to Vendors</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  loadingText: { fontSize: 14, marginTop: Spacing.md },
  headerCard: {
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  vendorAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  vendorAvatarText: { fontSize: 24, fontWeight: '700', color: '#F59E0B' },
  headerInfo: { flex: 1 },
  vendorName: { fontSize: 18, fontWeight: '700' },
  vendorContact: { fontSize: 13, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    width: '48%', borderRadius: Radius.lg, padding: Spacing.md,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statSub: { fontSize: 10, marginTop: 1 },
  progressCard: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  progressTitle: { fontSize: 15, fontWeight: '700' },
  progressStat: { fontSize: 13 },
  progressDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  progressDetailItem: { alignItems: 'center' },
  progressLabel: { fontSize: 11 },
  progressValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  itemCard: {
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  itemIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  itemSub: { fontSize: 12, marginTop: 1 },
  itemBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  itemBadgeText: { fontSize: 9, fontWeight: '700' },
  itemMeta: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.sm },
  itemMetaText: { fontSize: 12 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, marginTop: Spacing.md,
  },
  backText: { fontSize: 14, fontWeight: '600' },
});