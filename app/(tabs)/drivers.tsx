import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity,
  TextInput, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
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

export default function DriversScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeDeliveries, setActiveDeliveries] = useState<Record<string, any>>({});

  // Map driver IDs to active delivery
  useEffect(() => {
    const map: Record<string, any> = {};
    MOCK_DELIVERY_ORDERS.forEach((d: any) => {
      if (d.status !== 'delivered' && d.driverId) {
        map[d.driverId] = d;
      }
    });
    setActiveDeliveries(map);
  }, []);

  const filtered = MOCK_DRIVERS.filter((d) => {
    const s = (search || '').toLowerCase();
    return (
      (d.name || '').toLowerCase().includes(s) ||
      (d.phone || '').includes(s) ||
      (d.licenseNumber || '').toLowerCase().includes(s)
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
          </Text>
        </View>

        {/* Truck + License */}
        <View style={[styles.cardMeta, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
          {truck ? (
            <View style={styles.metaRow}>
              <Ionicons name="car" size={14} color={NAVY} />
              <Text style={[styles.metaText, { color: colors.text }]}>{truck.plateNumber}</Text>
              <View style={[styles.tinyDot, { backgroundColor: truckStatus[truck.status] || '#94A3B8' }]} />
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Ionicons name="car" size={14} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>Not assigned</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="id-card" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              Lic: {item.licenseNumber}
            </Text>
          </View>
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
  }, [colors, filtered, search, activeDeliveries]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, phone, or plate..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Driver Cards */}
      {filtered.length > 0 ? (
        <Animated.FlatList
          ref={flatListRef}
          data={filtered}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_SPACING}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.cardList}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          renderItem={renderDriverCard}
        />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No drivers found</Text>
        </View>
      )}

      {/* FAB - WhatsApp style green for "New Delivery" */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#25D366' }]}
        onPress={() => router.push('/(tabs)/orders')}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  cardList: {
    paddingVertical: Spacing.md,
    paddingRight: Spacing.lg,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTopSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  photoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: { fontSize: 20, fontWeight: '800' },
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, fontWeight: '700' },
  cardInfoSection: { marginBottom: Spacing.md },
  driverName: { fontSize: 17, fontWeight: '700' },
  companyName: { fontSize: 13, marginTop: 2 },
  phoneText: { fontSize: 12, marginTop: 4 },
  cardMeta: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: 4,
    marginBottom: Spacing.md,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, fontWeight: '500' },
  tinyDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },
  // Journey vertical timeline
  journeyWrap: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  journeyLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
  },
  vTimelineRow: {
    flexDirection: 'row',
    minHeight: 22,
  },
  vTimelineLeft: {
    alignItems: 'center',
    width: 18,
    marginRight: 4,
  },
  vTimelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vCheckmark: {
    fontSize: 8,
    color: '#FFF',
    fontWeight: '800',
  },
  vCurrentIcon: {
    fontSize: 6,
    color: '#FFF',
  },
  vTimelineLine: {
    width: 2,
    flex: 1,
    marginTop: 1,
    marginBottom: 1,
  },
  vTimelineContent: {
    flex: 1,
    paddingBottom: 1,
  },
  vTimelineStepText: {
    fontSize: 11,
    lineHeight: 16,
  },
  vTimelineSubtext: {
    fontSize: 9,
    color: '#1B2A4A',
    fontStyle: 'italic',
    marginLeft: 2,
  },
  journeyMaterial: { fontSize: 10, marginTop: 4, textAlign: 'center', fontStyle: 'italic' },
  // Idle state
  idleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  idleDot: { width: 8, height: 8, borderRadius: 4 },
  idleText: { fontSize: 12, fontWeight: '700' },
  // Stats
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 10, marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: '#E2E8F0' },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});
