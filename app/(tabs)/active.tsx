import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchCheckpoints, fetchDeliveryOrders } from '../../services/api';
import { formatEAT, JOURNEY_STEPS } from '../../utils/helpers';

const NAVY = '#1B2A4A';

// Status filter options
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'at_quarry', label: 'At Quarry' },
  { key: 'delivered', label: 'Delivered' },
];

/** Determine the status category from checkpoints */
function categorizeDeliveryStatus(checkpoints: any[]): string {
  const types = new Set(checkpoints.map((cp: any) => cp.type));
  if (types.has('received')) return 'delivered';
  if (types.has('weigh_out')) return 'in_transit';
  if (types.has('weigh_in')) return 'at_quarry';
  return 'assigned';
}

/** Get status color based on checkpoint type */
function getCheckpointColor(type: string, isCompleted: boolean, isCurrent: boolean): string {
  if (isCompleted) return '#16A34A'; // green
  if (isCurrent) return '#3B82F6'; // blue
  return '#CBD5E1'; // gray
}

function getCheckpointIcon(type: string, isCompleted: boolean, isCurrent: boolean): string {
  if (isCompleted) return 'checkmark-circle';
  if (isCurrent) return 'time';
  return 'ellipse-outline';
}

/** Find current step index */
function getCurrentStep(checkpoints: any[]): number {
  const completedTypes = new Set(checkpoints.map((cp: any) => cp.type));
  for (let i = JOURNEY_STEPS.length - 1; i >= 0; i--) {
    if (completedTypes.has(JOURNEY_STEPS[i].type)) return i;
  }
  return -1;
}

export default function ActiveScreen() {
  const colors = useTheme();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const allDeliveries = await fetchDeliveryOrders();
      const activeOnes = allDeliveries.filter((d: any) => d.status !== 'delivered');
      // Add delivered ones too (for "Delivered" filter)
      setDeliveries(allDeliveries || []);
    } catch (e) {
      console.error('Failed to load deliveries:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch checkpoints for all deliveries
  const [checkpointMap, setCheckpointMap] = useState<Record<string, any[]>>({});
  useEffect(() => {
    const loadCheckpoints = async () => {
      try {
        const cps = await fetchCheckpoints();
        if (cps) {
          const map: Record<string, any[]> = {};
          for (const cp of cps) {
            const key = cp.deliveryOrderId;
            if (!map[key]) map[key] = [];
            map[key].push(cp);
          }
          // Sort each delivery's checkpoints chronologically
          Object.keys(map).forEach(k => {
            map[k].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          });
          setCheckpointMap(map);
        }
      } catch (e) {
        console.error('Failed to load checkpoints:', e);
      }
    };
    loadCheckpoints();
  }, []);

  // Build enriched delivery list
  const enrichedDeliveries = useMemo(() => {
    return deliveries.map((d: any) => {
      const checkpoints = checkpointMap[d.id] || [];
      const category = categorizeDeliveryStatus(checkpoints);
      return {
        ...d,
        checkpoints,
        _category: category,
      };
    });
  }, [deliveries, checkpointMap]);

  const filtered = enrichedDeliveries.filter(d => {
    // Filter by status category
    if (activeFilter !== 'all') {
      if (activeFilter === 'at_quarry' && d._category !== 'at_quarry') return false;
      if (activeFilter === 'delivered' && d._category !== 'delivered') return false;
    }
    // Search
    if (search) {
      const s = search.toLowerCase();
      return (
        d.jobId?.toLowerCase().includes(s) ||
        d.driverName?.toLowerCase().includes(s) ||
        d.plateNumber?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const renderDeliveryCard = ({ item }: { item: any }) => {
    const currentStep = getCurrentStep(item.checkpoints);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/screens/delivery-note?id=${item.jobId}`)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="document-text" size={16} color={NAVY} />
            <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: NAVY + '12' }]}>
            <Text style={[styles.statusText, { color: NAVY }]}>
              {item._category.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Driver & Truck info */}
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {item.driverName || 'N/A'} · {item.plateNumber || 'N/A'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="cube-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {item.materialName || 'N/A'} · {item.quantityOrdered || '?'} tonnes
          </Text>
        </View>

        {/* Vertical Checkpoint Flow */}
        <View style={styles.timeline}>
          {JOURNEY_STEPS.map((step, idx) => {
            const matchingCp = item.checkpoints.find((cp: any) => cp.type === step.type);
            const isCompleted = !!matchingCp;
            const isCurrent = !isCompleted && idx === currentStep + 1;
            const dotColor = getCheckpointColor(step.type, isCompleted, isCurrent);
            const iconName = getCheckpointIcon(step.type, isCompleted, isCurrent);
            const isLast = idx === JOURNEY_STEPS.length - 1;

            return (
              <View key={step.type} style={styles.timelineRow}>
                {/* Dot + Line column */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                    {isCompleted && (
                      <Ionicons name="checkmark" size={10} color="#FFF" />
                    )}
                    {isCurrent && (
                      <View style={styles.pulsingDot}>
                        <View style={[styles.innerDot, { backgroundColor: dotColor }]} />
                      </View>
                    )}
                  </View>
                  {!isLast && (
                    <View style={[styles.timelineLine, { backgroundColor: dotColor + '40' }]} />
                  )}
                </View>

                {/* Content */}
                <View style={[
                  styles.timelineContent,
                  !isCompleted && !isCurrent && { opacity: 0.4 },
                  isCurrent && { opacity: 1 },
                ]}>
                  <View style={styles.timelineHeader}>
                    <Ionicons name={step.icon as any} size={14} color={dotColor} />
                    <Text style={[styles.timelineType, {
                      color: isCompleted ? '#16A34A' : isCurrent ? '#3B82F6' : '#94A3B8',
                      fontWeight: isCurrent ? '800' : '600',
                    }]}>
                      {step.label}
                    </Text>
                    {isCompleted && (
                      <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                    )}
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: '#3B82F620' }]}>
                        <Text style={[styles.currentText, { color: '#3B82F6' }]}>⏳ Pending</Text>
                      </View>
                    )}
                  </View>
                  {isCompleted && matchingCp && (
                    <>
                      <Text style={[styles.timelineLocation, { color: colors.textSecondary }]}>
                        {matchingCp.location || step.label}
                      </Text>
                      <Text style={[styles.timelineTime, { color: colors.textMuted }]}>
                        {formatEAT(matchingCp.timestamp)}
                      </Text>
                    </>
                  )}
                  {!isCompleted && !isCurrent && (
                    <Text style={[styles.timelinePending, { color: colors.textMuted }]}>
                      ⏳ Waiting
                    </Text>
                  )}
                  {isCurrent && !isCompleted && (
                    <Text style={[styles.timelinePending, { color: '#3B82F6' }]}>
                      ⏳ Pending
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Next step indicator */}
        {currentStep >= 0 && currentStep < JOURNEY_STEPS.length - 1 && (
          <View style={[styles.nextStep, { backgroundColor: NAVY + '10', borderColor: NAVY + '20' }]}>
            <Ionicons name="arrow-forward-circle" size={14} color={NAVY} />
            <Text style={[styles.nextStepText, { color: NAVY }]}>
              Next: {JOURNEY_STEPS[currentStep + 1].label} @ {item.siteName || 'Site'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by delivery note, driver, plate..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter tabs */}
      <FlatList
        horizontal
        data={FILTERS}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              { borderColor: colors.border },
              activeFilter === item.key && { backgroundColor: NAVY, borderColor: NAVY },
            ]}
            onPress={() => setActiveFilter(item.key)}
          >
            <Text style={[
              styles.filterText,
              { color: colors.textSecondary },
              activeFilter === item.key && { color: '#FFF' },
            ]}>
              {item.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="list-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active deliveries found</Text>
          </View>
        }
        renderItem={renderDeliveryCard}
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
  filterText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing['4xl'] },
  // Card
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobId: { fontSize: 15, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  infoText: { fontSize: 13 },
  // Timeline vertical flow
  timeline: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 44,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 28,
    marginRight: Spacing.sm,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
    marginBottom: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.sm,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  timelineType: { fontSize: 13 },
  timelineLocation: { fontSize: 12, marginLeft: 20 },
  timelineTime: { fontSize: 11, marginLeft: 20 },
  timelinePending: { fontSize: 11, marginLeft: 20, fontStyle: 'italic' },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  currentText: { fontSize: 9, fontWeight: '700' },
  // Next step
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  nextStepText: { fontSize: 12, fontWeight: '600' },
  // Empty
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
});
