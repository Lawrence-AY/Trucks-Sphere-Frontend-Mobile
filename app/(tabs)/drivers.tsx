import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
<<<<<<< HEAD
import { fetchDrivers } from '../../services/api';
import { getStatusColor, formatStatus } from '../../utils/helpers';
=======
import { MOCK_DRIVERS, MOCK_TRUCKS, MOCK_DELIVERY_ORDERS } from '../../store/mockData';
import { JOURNEY_STEPS } from '../../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_SPACING = Spacing.sm;

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: '#16A34A', label: 'Active' },
  inactive: { color: '#94A3B8', label: 'Inactive' },
  suspended: { color: '#DC2626', label: 'Suspended' },
};

const truckStatus: Record<string, string> = {
  active: '#16A34A',
  in_maintenance: '#D97706',
  out_of_service: '#DC2626',
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
>>>>>>> 1ffdc9493852547939d2de1b5c275b73fa3a2afd

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

<<<<<<< HEAD
  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      activeOpacity={0.7}
      onPress={() => router.push(`/screens/driver-history?id=${item.id}&name=${encodeURIComponent(item.name)}`)}
    >
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: '#10B98115' }]}>
          <Text style={[styles.avatarText, { color: '#10B981' }]}>
            {item.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'D'}
=======
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
    const activeDelivery = activeDeliveries[item.id];
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
        onPress={() => router.push(`/screens/driver-history?id=${item.id}&name=${encodeURIComponent(item.name)}`)}
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
>>>>>>> 1ffdc9493852547939d2de1b5c275b73fa3a2afd
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.phone, { color: colors.textSecondary }]}>{item.phone}</Text>
          <Text style={[styles.license, { color: colors.textSecondary }]}>
            License: {item.licenseNumber}
          </Text>
        </View>
<<<<<<< HEAD
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {formatStatus(item.status).toUpperCase()}
          </Text>
=======

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
>>>>>>> 1ffdc9493852547939d2de1b5c275b73fa3a2afd
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
  ratingText: { fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '600' },
});
