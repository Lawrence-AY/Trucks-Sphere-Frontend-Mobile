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
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT, getStatusColor, formatStatus } from '../../utils/helpers';
=======
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
>>>>>>> 1ffdc9493852547939d2de1b5c275b73fa3a2afd

export default function ActiveScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      const data = await fetchDeliveryOrders();
      setDeliveries(data || []);
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

<<<<<<< HEAD
  const filtered = deliveries.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (d.jobId || '').toLowerCase().includes(q) ||
      (d.driverName || '').toLowerCase().includes(q) ||
      (d.plateNumber || '').toLowerCase().includes(q) ||
      (d.materialName || '').toLowerCase().includes(q)
    );
=======
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
>>>>>>> 1ffdc9493852547939d2de1b5c275b73fa3a2afd
  });

  const activeDeliveries = filtered.filter((d) => d.status !== 'delivered');
  const completedDeliveries = filtered.filter((d) => d.status === 'delivered');

  const renderItem = ({ item }: { item: any }) => {
    const isCompleted = item.status === 'delivered';
    const netWt = item.netWeight || (item.weighInWeight && item.weighOutWeight
      ? (item.weighInWeight - item.weighOutWeight).toFixed(1) : null);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, opacity: isCompleted ? 0.75 : 1 }]}
        onPress={() => router.push(`/screens/delivery-note?id=${item.jobId}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.cardIcon, { backgroundColor: getStatusColor(item.status) + '12' }]}>
              <Ionicons
                name={isCompleted ? 'checkmark-circle' : 'navigate-circle'}
                size={20}
                color={getStatusColor(item.status)}
              />
            </View>
            <View>
              <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
              <Text style={[styles.plate, { color: colors.textSecondary }]}>{item.plateNumber}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {formatStatus(item.status).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>{item.driverName}</Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="cube-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>{item.materialName}</Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="navigate-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              {item.quarryName} → {item.siteName}
            </Text>
          </View>
          {netWt && (
            <View style={styles.cardRow}>
              <Ionicons name="speedometer-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>
                Net: {netWt} t
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.cardTime, { color: colors.textTertiary }]}>
          {formatEAT(item.updatedAt || item.createdAt)}
        </Text>
      </TouchableOpacity>
    );
  };

  const sections: { title: string; data: any[] }[] = [];
  if (activeDeliveries.length > 0) {
    sections.push({ title: `Active (${activeDeliveries.length})`, data: activeDeliveries });
  }
  if (completedDeliveries.length > 0) {
    sections.push({ title: `Completed (${completedDeliveries.length})`, data: completedDeliveries });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by job, driver, plate..."
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
        data={sections}
        keyExtractor={(s) => s.title}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            {section.data.map((item: any) => (
              <View key={item.id}>{renderItem({ item })}</View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="car-outline" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No deliveries found</Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                {search ? 'Try a different search term' : 'All deliveries are completed'}
              </Text>
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
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.md },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  jobId: { fontSize: 14, fontWeight: '700' },
  plate: { fontSize: 12, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardBody: { gap: 5 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardText: { fontSize: 13 },
  cardTime: { fontSize: 11, marginTop: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
});
