import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  TextInput, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDrivers } from '../../services/api';
import { getStatusColor, formatStatus, JOURNEY_STEPS } from '../../utils/helpers';
import { MOCK_DRIVERS, MOCK_TRUCKS, MOCK_DELIVERY_ORDERS } from '../../store/mockData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_SPACING = Spacing.sm;

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: '#16A34A', label: 'Active' },
  inactive: { color: '#94A3B8', label: 'Inactive' },
  suspended: { color: '#DC2626', label: 'Suspended' },
};

const NAVY = '#1B2A4A';

// Get vendor name from vendor ID
const getVendorName = (vendorId: string): string => {
  const map: Record<string, string> = {
    v1: 'Mwangi Transport Ltd',
    v2: 'Kamau Trucking Co',
    v3: 'Ochieng Supplies Ltd',
    v4: 'Njoroge Heavy Haulage',
    v5: 'Wanjiku Logistics',
  };
  return map[vendorId] || 'Unknown';
};

// Emoji/icon for each journey step
const stepEmoji: Record<string, string> = {
  origin: '🏭',
  weigh_in: '⚖️',
  weigh_out: '⚖️',
  arrived_site: '🏗️',
  received: '✅',
};

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

  const filtered = drivers.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (d.name || '').toLowerCase().includes(q) ||
      (d.phone || '').includes(q) ||
      (d.licenseNumber || '').toLowerCase().includes(q)
    );
  });

  const getTruckForDriver = (driverId: string) =>
    MOCK_TRUCKS.find(t => t.assignedDriverId === driverId);

  const getJourneySteps = (delivery: any) => {
    if (!delivery) return [];
    return JOURNEY_STEPS.map((s, i) => {
      const type = s.type;
      const isCompleted = type === 'origin' ? true :
        type === 'weigh_in' ? !!delivery.weighInWeight :
        type === 'weigh_out' ? !!delivery.weighOutWeight :
        type === 'arrived_site' ? !!delivery.deliveredAt :
        type === 'received' ? !!delivery.receivedAt : false;
      return { type, completed: isCompleted, label: s.label, icon: s.icon, color: s.color };
    });
  };

  const getJourneyEmoji = (type: string): string => stepEmoji[type] || '📍';

  const renderDriverCard = useCallback(({ item, index }: { item: typeof MOCK_DRIVERS[0]; index: number }) => {
    const stat = statusConfig[item.status] || { color: '#64748B', label: item.status };
    const truck = getTruckForDriver(item.id);
    const activeDelivery = MOCK_DELIVERY_ORDERS.find(d => d.driverId === item.id && d.status !== 'delivered' && d.status !== 'cancelled');
    const journeySteps = getJourneySteps(activeDelivery);
    const firstIncompleteIdx = journeySteps.findIndex(s => !s.completed);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            marginLeft: index === 0 ? Spacing.lg : 0,
            marginRight: index === filtered.length - 1 ? Spacing.lg : CARD_SPACING,
          },
        ]}
        onPress={() => router.push(`/screens/driver-history?id=${item.id}&name=${encodeURIComponent(item.name || '')}`)}
        activeOpacity={0.85}
      >
        {/* Photo/Avatar + Status badge */}
        <View style={styles.cardTopSection}>
          <View style={[styles.photoCircle, { backgroundColor: NAVY + '15' }]}>
            <Text style={[styles.photoText, { color: NAVY }]}>
              {item.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
          <View style={[styles.cardStatusBadge, { backgroundColor: stat.color + '15' }]}>
            <View style={[styles.dot, { backgroundColor: stat.color }]} />
            <Text style={[styles.statusLabel, { color: stat.color }]}>{stat.label}</Text>
          </View>
        </View>

        {/* Driver Info */}
        <View style={styles.cardInfoSection}>
          <Text style={[styles.driverName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.companyName, { color: colors.textSecondary }]}>
            {getVendorName(item.vendorId)}
          </Text>
          <Text style={[styles.phoneText, { color: colors.textMuted }]}>
            <Ionicons name="call-outline" size={12} /> {item.phone}
          </Text>
        </View>

        {/* Journey Timeline (vertical) */}
        {journeySteps.length > 0 ? (
          <View style={[styles.journeyWrap, { backgroundColor: NAVY + '08', borderColor: NAVY + '20' }]}>
            <Text style={[styles.journeyLabel, { color: NAVY }]}>
              <Ionicons name="location-outline" size={11} color={NAVY} /> Active Delivery
            </Text>
            {journeySteps.map((step, idx) => {
              const isCompleted = step.completed;
              const isCurrent = !isCompleted && idx === firstIncompleteIdx;
              const dotColor = isCompleted ? '#16A34A' : isCurrent ? '#1B2A4A' : '#9CA3AF';
              const textColor = isCompleted ? '#16A34A' : isCurrent ? '#1B2A4A' : '#9CA3AF';
              const label = step.label;
              const isLast = idx === journeySteps.length - 1;

              return (
                <View key={step.type} style={styles.vTimelineRow}>
                  <View style={styles.vTimelineLeft}>
                    <View style={[styles.vTimelineDot, { backgroundColor: dotColor }]}>
                      {isCompleted && <Text style={styles.vCheckmark}>✓</Text>}
                      {isCurrent && <Text style={styles.vCurrentIcon}>●</Text>}
                    </View>
                    {!isLast && (
                      <View style={[styles.vTimelineLine, {
                        backgroundColor: isCompleted ? '#16A34A' : '#E2E8F0',
                      }]} />
                    )}
                  </View>
                  <View style={styles.vTimelineContent}>
                    <Text style={[styles.vTimelineStepText, { color: textColor, fontWeight: (isCurrent ? '700' : '500') as any }]}>
                      {getJourneyEmoji(step.type)} {label}
                      {isCompleted && <Text style={{ color: '#16A34A' }}> ✓</Text>}
                      {isCurrent && <Text style={{ color: '#1B2A4A' }}> 🔄</Text>}
                      {!isCompleted && !isCurrent && <Text style={{ color: '#9CA3AF' }}> ⏳</Text>}
                    </Text>
                    {isCurrent && (
                      <Text style={styles.vTimelineSubtext}>Pending</Text>
                    )}
                  </View>
                </View>
              );
            })}
            {/* Material info */}
            {activeDelivery && (
              <Text style={[styles.journeyMaterial, { color: colors.textMuted }]}>
                {activeDelivery.materialName} · {activeDelivery.quantityOrdered} tonnes
              </Text>
            )}
          </View>
        ) : (
          <View style={[styles.idleWrap, { backgroundColor: '#16A34A' + '12', borderColor: '#16A34A' + '30' }]}>
            <View style={[styles.idleDot, { backgroundColor: '#16A34A' }]} />
            <Text style={[styles.idleText, { color: '#16A34A' }]}>Available / Idle</Text>
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {(item as any).totalTrips || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{(item as any).monthTrips || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Month</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [colors, filtered.length]);

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
        renderItem={renderDriverCard}
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
    width: CARD_WIDTH,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTopSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  photoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: { fontSize: 16, fontWeight: '700' },
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700' },
  cardInfoSection: { marginBottom: Spacing.md },
  driverName: { fontSize: 16, fontWeight: '700' },
  companyName: { fontSize: 13, marginTop: 2 },
  phoneText: { fontSize: 12, marginTop: 4 },
  // Journey Timeline
  journeyWrap: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  journeyLabel: { fontSize: 11, fontWeight: '700', marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  vTimelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 32 },
  vTimelineLeft: { alignItems: 'center', width: 20, marginRight: Spacing.sm },
  vTimelineDot: { width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  vCheckmark: { fontSize: 8, color: '#fff', fontWeight: '700' },
  vCurrentIcon: { fontSize: 8, color: '#fff' },
  vTimelineLine: { width: 2, flex: 1, marginTop: 2 },
  vTimelineContent: { flex: 1, paddingBottom: Spacing.xs },
  vTimelineStepText: { fontSize: 12 },
  vTimelineSubtext: { fontSize: 10, color: '#1B2A4A', marginTop: 1 },
  journeyMaterial: { fontSize: 11, marginTop: Spacing.sm },
  // Idle state
  idleWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.md, borderWidth: 1,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  idleDot: { width: 8, height: 8, borderRadius: 4 },
  idleText: { fontSize: 12, fontWeight: '600' },
  // Stats
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: '#E2E8F0' },
  // Empty state
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '600' },
});
