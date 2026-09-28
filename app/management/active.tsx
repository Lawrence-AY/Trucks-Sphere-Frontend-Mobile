import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
   StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
   Alert,
  useWindowDimensions,
} from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Searchbar } from 'react-native-paper';
import { ManagementHeaderMenuButton } from '../../components/management/ManagementMenuContext';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { useDeliveryOrders, useDrivers, useMaterials } from '@/store/realtimeData';
import { useRealTimeSyncStore } from '@/store/realTimeSyncStore';
import { formatEAT } from '../../utils/helpers';
import { isActiveJob } from '../../utils/jobStatus';
import {
  DataCard,
  EmptyState,
   PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';
import { TripListCard } from '../../components/TripListCard';

// ─── Flag detection ──────────────────────────────────────────────
function isFlagged(item: any) {
  const net = Number(item.netWeight || 0);
  return net > 0 && (net < 19 || net > 23);
}

// ─── CSV export helpers ──────────────────────────────────────────
function escapeCsvField(value: any): string {
  if (value == null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsv(headers: string[], rows: string[][]): string {
  const hdr = headers.map(escapeCsvField).join(',');
  const body = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
  return `${hdr}\n${body}`;
}

// ─── Filter definitions ──────────────────────────────────────────
const TIME_FILTERS = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: 'week', label: 'Week', icon: 'calendar-outline' },
  { key: 'month', label: 'Month', icon: 'calendar-outline' },
  { key: 'flagged', label: 'Flagged', icon: 'alert-circle-outline' },
];

export default function ManagementActiveScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const headerSearchWidth = width < 430 ? 160 : 220;
  const refresh = useRealTimeSyncStore((s) => s.refresh);

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('');
  const [matDropdownOpen, setMatDropdownOpen] = useState(false);
  const [matSearch, setMatSearch] = useState('');

  // Realtime data
  const deliveries = useDeliveryOrders();
  const drivers = useDrivers();
  const materials = useMaterials();

  const driverPhotos = useMemo(
    () =>
      new Map(
        drivers.map((driver: any) => [
          String(driver.id || '').trim(),
          driver.photoURL || driver.photoUrl || '',
        ])
      ),
    [drivers]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh('deliveryOrders'), refresh('materials')]);
    setRefreshing(false);
  }, [refresh]);

  // ─── Time range helpers ────────────────────────────────────────
  const now = new Date();
  const getStartOfPeriod = (period: string): Date => {
    const d = new Date(now);
    if (period === 'today') {
      d.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  };

  // ─── Filter logic ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    const periodStart = getStartOfPeriod(filter);

    return deliveries.filter((item) => {
      if (!isActiveJob(item.status)) return false;
      if (item.isBackorder) return false;
      if (!item.driverId && !item.driverName && !item.isWarehouseDelivery && !item.warehouseJobId && item.deliveryOrigin !== 'warehouse') return false;

      // Search
      const matchesSearch = !query ||
        [
          item.jobId,
          item.poNumber,
          item.driverName,
          item.plateNumber,
          item.vendorName,
          item.materialName,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      if (!matchesSearch) return false;

      // Time filter
      if (filter !== 'all' && filter !== 'flagged') {
        const itemDate = new Date(item.updatedAt || item.createdAt);
        if (itemDate < periodStart) return false;
      }

      // Flagged filter
      if (filter === 'flagged') {
        if (!isFlagged(item)) return false;
      }

      // Material filter
      if (materialFilter && item.materialId !== materialFilter) return false;

      return true;
    });
  }, [deliveries, filter, search, materialFilter]);

  const matFiltered = matSearch.trim()
    ? materials.filter((m) => (m.name || '').toLowerCase().includes(matSearch.toLowerCase()))
    : materials;

  const selectedMaterial = materials.find((m) => m.id === materialFilter);

  // ─── Export ──────────────────────────────────────────────────────
  const buildDeliveryRows = (records: any[]): string[][] =>
    records.map((r) => [
      r.jobId || '',
      r.poNumber || '',
      r.driverName || '',
      r.plateNumber || '',
      r.vendorName || '',
      r.materialName || '',
      String(r.quantityOrdered ?? ''),
      r.weighInWeight != null ? r.weighInWeight.toFixed(1) : '—',
      r.weighOutWeight != null ? r.weighOutWeight.toFixed(1) : '—',
      r.netWeight != null ? r.netWeight.toFixed(1) : '—',
      r.status || '',
      formatEAT(r.updatedAt || r.createdAt),
    ]);

 
  

  const isLoading = deliveries.length === 0 && materials.length === 0;

  return (
    <>
      <Tabs.Screen
        options={{
          title: 'Active Trips',
          headerLeft: () => (
            <View style={styles.headerLeftGroup}>
              <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>Active Trips</Text>
              <Searchbar
                placeholder="Search"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                style={[styles.headerSearch, { width: headerSearchWidth, backgroundColor: colors.inputBg }]}
                inputStyle={[styles.headerSearchInput, { color: colors.text }]}
              />
            </View>
          ),
          headerTitle: () => null,
          headerRight: () => (
            <View style={styles.headerRightGroup}>
               
              <ManagementHeaderMenuButton />
            </View>
          ),
        }}
      />

      <PageShell
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* ─── Filter chips ────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {TIME_FILTERS.map((option) => {
            const isActive = filter === option.key;
            let chipBg = isActive ? colors.primary : colors.surface;
            let textColor = isActive ? '#FFFFFF' : colors.text;
            let borderColor = isActive ? colors.primary : colors.border;

            // Special colour for flagged chip
            if (option.key === 'flagged' && isActive) {
              chipBg = '#EF4444'; // red
              textColor = '#FFFFFF';
              borderColor = '#EF4444';
            }

            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterChip,
                  { backgroundColor: chipBg, borderColor: borderColor },
                ]}
                onPress={() => setFilter(option.key)}
                activeOpacity={0.7}
              >
                 <Text style={[styles.filterChipText, { color: textColor }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ─── Material filter dropdown ────────────────────────── */}
        <View style={styles.matFilterContainer}>
          <TouchableOpacity
            style={[
              styles.matFilterButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            onPress={() => {
              setMatDropdownOpen(!matDropdownOpen);
              setMatSearch('');
            }}
          >
            <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
            <Text
              style={[
                styles.matFilterLabel,
                { color: selectedMaterial ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {selectedMaterial ? selectedMaterial.name : 'Filter by material...'}
            </Text>
            {materialFilter ? (
              <TouchableOpacity onPress={() => setMaterialFilter('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name={matDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          {matDropdownOpen && (
            <View
              style={[
                styles.matDropdown,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <View style={[styles.matSearchRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="search" size={14} color={colors.textMuted} />
                <TextInput
                  style={[styles.matSearchInput, { color: colors.text }]}
                  placeholder="Search materials..."
                  placeholderTextColor={colors.textMuted}
                  value={matSearch}
                  onChangeText={setMatSearch}
                  autoFocus
                />
              </View>
              <ScrollView style={styles.matList} nestedScrollEnabled>
                {matFiltered.map((m: any) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.matItem}
                    onPress={() => {
                      setMaterialFilter(m.id);
                      setMatDropdownOpen(false);
                    }}
                  >
                    <Text style={[styles.matItemText, { color: colors.text }]} numberOfLines={1}>
                      {m.name || m.id}
                    </Text>
                    {m.id === materialFilter && (
                      <Ionicons name="checkmark" size={16} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <SectionTitle title={`${filtered.length} active deliveries`} />

        {isLoading ? (
          <DataCard>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>Loading movement board...</Text>
          </DataCard>
        ) : filtered.length ? (
          <View style={styles.tripList}>
            {filtered.map((item) => {
              const driverPhoto = driverPhotos.get(String(item.driverId || '').trim());

              return (
                <TripListCard
                  key={item.id}
                  trip={item}
                  driverPhoto={driverPhoto}
                  onPress={() => router.push(`/operations/jobs/${item.id}` as any)}
                  
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="file-tray-outline"
            title="No deliveries found"
            subtitle="Try a broader search or another filter."
          />
        )}
      </PageShell>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerLeftGroup: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    width: 92,
    fontSize: 14,
    fontWeight: '700',
  },
  headerSearch: {
    height: 38,
    marginRight: 0,
    borderRadius: Radius.md,
    
  },
  headerSearchInput: {
    minHeight: 0,
    fontSize: 14,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    gap: 4,
  },
  headerIcon: {
    padding: 6,
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
   
  },
  chipIcon: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  matFilterContainer: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    position: 'relative',
    zIndex: 10,
  },
  matFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  matFilterLabel: {
    flex: 1,
    fontSize: 13,
  },
  matDropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    overflow: 'hidden',
  },
  matSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 6,
  },
  matSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 2,
  },
  matList: {
    maxHeight: 150,
  },
  matItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  matItemText: {
    fontSize: 13,
    flex: 1,
  },
  tripList: {
    gap: 0.1,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    alignSelf: 'flex-start',
  },
  flagBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});