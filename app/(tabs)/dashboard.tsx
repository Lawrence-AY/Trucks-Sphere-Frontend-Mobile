import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import {
  fetchDrivers, fetchVehicles, fetchPurchaseOrders, fetchDeliveryOrders,
} from '../../services/api';
import { formatEAT, getStatusColor, formatStatus, getRoleLabel } from '../../utils/helpers';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const colors = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    activeDrivers: 0,
    activeTrucks: 0,
    pendingOrders: 0,
    activeDeliveries: 0,
  });
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const role = user?.role || 'management';

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [drivers, vehicles, orders, deliveries] = await Promise.all([
        fetchDrivers(),
        fetchVehicles(),
        fetchPurchaseOrders(),
        fetchDeliveryOrders(),
      ]);

      const activeDrivers = (drivers || []).filter((d: any) => d.status === 'active').length;
      const activeTrucks = (vehicles || []).filter((t: any) => t.status === 'active').length;
      const pendingOrders = (orders || []).filter(
        (o: any) => o.status === 'pending' || o.status === 'in_progress'
      ).length;
      const activeDeliveries = (deliveries || []).filter((d: any) => d.status !== 'delivered').length;

      setStats({ activeDrivers, activeTrucks, pendingOrders, activeDeliveries });

      const pending = (deliveries || [])
        .filter((d: any) => d.status !== 'delivered')
        .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
        .slice(0, 3);
      setRecentDeliveries(pending);
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => loadData();

  const MetricCard = ({ icon, label, value, color, onPress }: any) => (
    <TouchableOpacity
      style={[styles.metricCard, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.metricIconWrap, { backgroundColor: color + '12' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const RecentDeliveryCard = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.deliveryCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/screens/delivery-note?id=${item.jobId}`)}
      activeOpacity={0.7}
    >
      <View style={styles.deliveryTop}>
        <View style={styles.deliveryTopLeft}>
          <View style={[styles.deliveryIcon, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="document-text" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) + '15' },
        ]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {formatStatus(item.status).toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.deliveryInfo}>
        <View style={styles.deliveryDetailRow}>
          <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.deliveryDetail, { color: colors.textSecondary }]}>
            {item.driverName} · {item.plateNumber}
          </Text>
        </View>
        <View style={styles.deliveryDetailRow}>
          <Ionicons name="cube-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.deliveryDetail, { color: colors.textSecondary }]}>
            {item.materialName}
          </Text>
        </View>
        <View style={styles.deliveryDetailRow}>
          <Ionicons name="navigate-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.deliveryDetail, { color: colors.textSecondary }]}>
            {item.quarryName} → {item.siteName}
          </Text>
        </View>
        <Text style={[styles.deliveryTime, { color: colors.textTertiary }]}>
          {formatEAT(item.updatedAt || item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.welcomeArea}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user?.displayName || user?.email?.split('@')[0] || 'User'}
            </Text>
          </View>
        </View>
        <View style={styles.loadingSkeleton}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.surface }]} />
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Welcome */}
      <View style={styles.welcomeArea}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.displayName || user?.email?.split('@')[0] || 'User'}
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
          <Text style={[styles.roleText, { color: colors.primary }]}>
            {getRoleLabel(role).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Metrics */}
      <View style={styles.metricsRow}>
        <MetricCard
          icon="car"
          label="Active Trucks"
          value={stats.activeTrucks}
          color="#1B2A4A"
          onPress={() => router.push('/trucks')}

        />
        <MetricCard
          icon="people"
          label="Active Drivers"
          value={stats.activeDrivers}
          color="#10B981"
          onPress={() => router.push('/(tabs)/drivers')}
        />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard
          icon="document-text"
          label="Pending Orders"
          value={stats.pendingOrders}
          color="#D97706"
          onPress={() => router.push('/(tabs)/orders')}
        />
        <MetricCard
          icon="navigate"
          label="Active Deliveries"
          value={stats.activeDeliveries}
          color="#7C3AED"
          onPress={() => router.push('/(tabs)/active')}
        />
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsRow}>
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.surface }]} onPress={() => router.push('/(tabs)/active')}>
          <View style={[styles.qaIcon, { backgroundColor: '#3B82F615' }]}>
            <Ionicons name="location" size={22} color="#3B82F6" />
          </View>
          <Text style={[styles.qaLabel, { color: colors.text }]}>Track</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.surface }]} onPress={() => router.push('/(tabs)/orders')}>
          <View style={[styles.qaIcon, { backgroundColor: '#10B98115' }]}>
            <Ionicons name="add-circle" size={22} color="#10B981" />
          </View>
          <Text style={[styles.qaLabel, { color: colors.text }]}>New Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.surface }]} onPress={() => router.push('/(tabs)/drivers')}>
          <View style={[styles.qaIcon, { backgroundColor: '#8B5CF615' }]}>
            <Ionicons name="people" size={22} color="#8B5CF6" />
          </View>
          <Text style={[styles.qaLabel, { color: colors.text }]}>Drivers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.surface }]} onPress={() => router.push('/(tabs)/search')}>
          <View style={[styles.qaIcon, { backgroundColor: '#F59E0B15' }]}>
            <Ionicons name="search" size={22} color="#F59E0B" />
          </View>
          <Text style={[styles.qaLabel, { color: colors.text }]}>Search</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Active Deliveries */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Deliveries</Text>
        {recentDeliveries.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/(tabs)/active')}>
            <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
          </TouchableOpacity>
        )}
      </View>
      {recentDeliveries.map((d, i) => (
        <RecentDeliveryCard key={d.id || i} item={d} />
      ))}
      {recentDeliveries.length === 0 && (
        <View style={styles.emptyDeliveries}>
          <View style={[styles.emptyIcon, { backgroundColor: '#10B98115' }]}>
            <Ionicons name="checkmark-circle" size={32} color="#10B981" />
          </View>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>All deliveries completed</Text>
          <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>No active deliveries at the moment</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  welcomeArea: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing['2xl'],
  },
  greeting: { fontSize: 14 },
  userName: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  roleText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  loadingSkeleton: { gap: Spacing.md },
  skeletonCard: { height: 80, borderRadius: Radius.lg, opacity: 0.5 },
  metricsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  metricCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricIconWrap: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  metricValue: { fontSize: 24, fontWeight: '800' },
  metricLabel: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  viewAll: { fontSize: 13, fontWeight: '600' },
  quickActionsRow: { marginBottom: Spacing.lg, marginTop: Spacing.sm },
  quickAction: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginRight: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  qaIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  qaLabel: { fontSize: 12, fontWeight: '600' },
  deliveryCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deliveryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  deliveryTopLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  deliveryIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  jobId: { fontSize: 14, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  deliveryInfo: { gap: 6 },
  deliveryDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveryDetail: { fontSize: 13 },
  deliveryTime: { fontSize: 11, marginTop: 2 },
  emptyDeliveries: { alignItems: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptySubtext: { fontSize: 13 },
});
