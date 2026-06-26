import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import {
  fetchDrivers, fetchVehicles, fetchPurchaseOrders, fetchDeliveryOrders,
} from '../../services/api';
import { formatEAT, getStatusColor, formatStatus } from '../../utils/helpers';

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

      // Show latest active deliveries
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
      style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.metricIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  const RecentDeliveryCard = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.deliveryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/screens/delivery-note?id=${item.jobId}`)}
    >
      <View style={styles.deliveryTop}>
        <Text style={[styles.jobId, { color: colors.accent }]}>{item.jobId}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: (getStatusColor(item.status)) + '15' },
        ]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {formatStatus(item.status).toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.deliveryInfo}>
        <Text style={[styles.deliveryDetail, { color: colors.textSecondary }]}>
          {item.driverName} · {item.plateNumber}
        </Text>
        <Text style={[styles.deliveryDetail, { color: colors.textSecondary }]}>
          {item.materialName} · {item.quarryName} → {item.siteName}
        </Text>
        <Text style={[styles.deliveryTime, { color: colors.textTertiary }]}>
          {formatEAT(item.updatedAt || item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Derive todayWeighments and todayDeliveries for display
  const todayWeighments = '—';
  const todayDeliveries = '—';

  if (loading) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.welcomeArea}>
          <View>
             
            <Text style={[styles.userName, { color: colors.text }]}>
              {user?.displayName || user?.email?.split('@')[0] || 'User'}
            </Text>
          </View>
        </View>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading dashboard...</Text>
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
           
          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.displayName || user?.email?.split('@')[0] || 'User'}
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: colors.accent + '15' }]}>
          <Text style={[styles.roleText, { color: colors.accent }]}>
            {role.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Metrics */}
      <View style={styles.metricsRow}>
        <MetricCard
          icon="car"
          label="Active Trucks"
          value={stats.activeTrucks}
          color={colors.accent}
          onPress={() => router.push('/(tabs)/trucks')}
        />
        <MetricCard
          icon="people"
          label="Active Drivers"
          value={stats.activeDrivers}
          color="#16A34A"
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

      {/* Active Deliveries */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Deliveries</Text>
      {recentDeliveries.map((d, i) => (
        <RecentDeliveryCard key={d.id || i} item={d} />
      ))}
      {recentDeliveries.length === 0 && (
        <View style={styles.emptyDeliveries}>
          <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>All deliveries completed</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  welcomeArea: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.xl,
  },
  welcomeGreeting: { fontSize: 14 },
  userName: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  roleBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  roleText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  loadingText: { textAlign: 'center', marginTop: Spacing['4xl'], fontSize: 14 },
  metricsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  metricCard: {
    flex: 1, borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.lg, alignItems: 'center',
  },
  metricIconWrap: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  metricValue: { fontSize: 24, fontWeight: '800' },
  metricLabel: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md, marginTop: Spacing.md },
  deliveryCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  deliveryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  jobId: { fontSize: 13, fontWeight: '700' },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '700' },
  deliveryInfo: { gap: 4 },
  deliveryDetail: { fontSize: 13 },
  deliveryTime: { fontSize: 11 },
  emptyDeliveries: { alignItems: 'center', paddingVertical: Spacing['2xl'], gap: Spacing.sm },
  emptyText: { fontSize: 14 },
});
