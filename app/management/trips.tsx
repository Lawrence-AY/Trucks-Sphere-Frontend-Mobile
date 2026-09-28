import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from '../../utils/router';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { useDeliveryOrders, useDrivers } from '@/store/realtimeData';
import { useRealTimeSyncStore } from '@/store/realTimeSyncStore';
import { isActiveJob, normalizeJobStatus } from '../../utils/jobStatus';
import { EmptyState, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { TripListCard } from '../../components/TripListCard';
import { ManagementSearchHeader } from '../../components/ManagementSearchHeader';

type FilterType = 'all' | 'today' | 'week' | 'weightFlag' | 'securityFlag';

export default function ManagementTripsScreen() {
  const colors = useTheme();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const showAllTrips = scope === 'all';
  const deliveries = useDeliveryOrders();
  const drivers = useDrivers();
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const driverPhotos = useMemo(
    () =>
      new Map(
        drivers.map((driver: any) => [
          String(driver.id || '').trim(),
          driver.photoURL || driver.photoUrl || '',
        ]),
      ),
    [drivers],
  );

  // Total trips includes active shipments; Delivered opens completed trips.
  const completedTrips = useMemo(() => {
    return deliveries
      .filter((item) => {
        const status = normalizeJobStatus(item.status);
        return !item.isBackorder && status !== 'CANCELLED' && (showAllTrips || !isActiveJob(status));
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      );
  }, [deliveries, showAllTrips]);

  // ----- Flag detection helpers (robust) -----
  const hasWeightFlag = (item: any) => {
    // 1. Explicit boolean flags
    if (item.weightFlag || item.weightFlagged || item.isWeightFlagged || item.weightIssue) {
      return true;
    }
    // 2. Numeric weight variation beyond a small tolerance
    const variation = item.weightVariation ?? item.weightVariance ?? 0;
    return Math.abs(variation) > 0.5; // 0.5 kg tolerance
  };

  const hasSecurityFlag = (item: any) => {
    return !!(item.securityFlag || item.securityFlagged || item.isSecurityFlagged || item.securityIssue);
  };
  // ------------------------------------------

  // Apply filters and search
  const trips = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);

    let filtered = completedTrips;

    switch (filterType) {
      case 'today':
        filtered = filtered.filter((item) => {
          const date = new Date(item.updatedAt || item.createdAt || 0);
          return date >= todayStart;
        });
        break;
      case 'week':
        filtered = filtered.filter((item) => {
          const date = new Date(item.updatedAt || item.createdAt || 0);
          return date >= weekAgo;
        });
        break;
      case 'weightFlag':
        filtered = filtered.filter((item) => hasWeightFlag(item));
        break;
      case 'securityFlag':
        filtered = filtered.filter((item) => hasSecurityFlag(item));
        break;
      default: // 'all'
        break;
    }

    if (query) {
      filtered = filtered.filter((item) =>
        [item.jobId, item.driverName, item.plateNumber, item.poNumber, item.materialName]
          .some((value) => String(value || '').toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [completedTrips, filterType, search]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh('deliveryOrders');
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // Filter definitions with icons
  const filters: { label: string; value: FilterType; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'All', value: 'all', icon: 'grid-outline' },
    { label: 'Today', value: 'today', icon: 'today-outline' },
    { label: 'This Week', value: 'week', icon: 'calendar-outline' },
    //{ label: 'Weight Flag', value: 'weightFlag', icon: 'scale-outline' },
   // { label: 'Security Flag', value: 'securityFlag', icon: 'shield-outline' },
  ];

  const getFilterLabel = () => {
    const found = filters.find((f) => f.value === filterType);
    return found ? found.label : 'All';
  };

  return (
    <>
      <ManagementSearchHeader
        title="Trips"
        search={search}
        onChangeSearch={setSearch}
        placeholder={showAllTrips ? "Search all trips..." : "Search completed trips..."}
      />

      {/* Filter Chips with Icons */}
      <View style={[styles.filterWrapper, { backgroundColor: colors.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {filters.map((option) => {
            const isActive = filterType === option.value;
            let chipBg = isActive ? colors.primary : colors.surface;
            let textColor = isActive ? '#FFFFFF' : colors.text;
            let borderColor = isActive ? colors.primary : colors.border;

            // Special colours for flag chips
            if (option.value === 'weightFlag' && isActive) {
              chipBg = '#EF4444'; // red for weight
              textColor = '#FFFFFF';
              borderColor = '#EF4444';
            } else if (option.value === 'securityFlag' && isActive) {
              chipBg = '#8B5CF6'; // purple for security
              textColor = '#FFFFFF';
              borderColor = '#8B5CF6';
            }

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: chipBg,
                    borderColor: borderColor,
                  },
                ]}
                onPress={() => setFilterType(option.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={option.icon}
                  size={16}
                  color={textColor}
                  style={styles.chipIcon}
                />
                <Text style={[styles.filterChipText, { color: textColor }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <PageShell
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <SectionTitle
          title={`${trips.length} ${filterType === 'all' ? (showAllTrips ? 'total' : 'completed') : getFilterLabel().toLowerCase()} trips`}
        />

        {trips.length ? (
          <View style={styles.tripList}>
            {trips.map((item) => {
              const receiptJobId = item.jobId || item.id;
              const driverPhoto = driverPhotos.get(String(item.driverId || '').trim());
              const weightFlag = hasWeightFlag(item);
              const securityFlag = hasSecurityFlag(item);

              return (
                <TripListCard
                  key={item.id}
                  trip={item}
                  driverPhoto={driverPhoto}
                  onPress={() => router.push(`/operations/jobs/${item.id}` as any)}
                  bottomAction={
                    <View style={styles.bottomActionRow}>
                      <View style={styles.flagBadges}>
                       
                       
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.receiptAction,
                          { backgroundColor: '#10B98115', borderColor: '#10B98133' },
                        ]}
                        onPress={(event) => {
                          event.stopPropagation();
                          router.push(
                            `/screens/receipt-note?id=${encodeURIComponent(receiptJobId)}` as any,
                          );
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Open receipt note for ${receiptJobId}`}
                      >
                        <Text style={styles.receiptActionText}>Receipt Note</Text>
                        <Text style={styles.receiptNumber} numberOfLines={1}>
                          {item.receiptNoteId || receiptJobId}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="checkmark-done-outline"
            title="No matching trips"
            subtitle={
              filterType === 'all'
                ? (showAllTrips ? 'No trips yet.' : 'No completed trips yet.')
                : `No ${getFilterLabel().toLowerCase()} trips found.`
            }
          />
        )}
      </PageShell>
    </>
  );
}

const styles = StyleSheet.create({
  filterWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  filterContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginRight: Spacing.xs,
   
    elevation: 0,
  },
  chipIcon: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tripList: {
    gap: 0.1,
  },
  bottomActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  flagBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  flagBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  receiptAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  receiptActionText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  receiptNumber: {
    color: '#059669',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
});
