import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ResponsiveGrid } from '../../components/ResponsiveGrid';
import { TripListCard } from '../../components/TripListCard';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { normalizeVendorId } from '../../utils/helpers';
import { isActiveJob, normalizeJobStatus } from '../../utils/jobStatus';
import { useRealtimeCollection } from '@/store/realtimeData';
import { useRealTimeSyncStore } from '@/store/realTimeSyncStore';
import {
  DataCard,
  EmptyState,
  FilterRail,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';
import { Gap } from '../../constants/theme';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function VendorTripsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const vendorId = user?.vendorId || 'v1';
  const normalizedUserVendorId = normalizeVendorId(vendorId);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const { status } = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState(status === 'completed' ? 'completed' : 'all');
  useEffect(() => { setFilter(status === 'completed' ? 'completed' : 'all'); }, [status]);
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const { data: deliveryData, loading: deliveriesLoading } = useRealtimeCollection('deliveryOrders');
  const { data: allDrivers } = useRealtimeCollection('drivers');

  const loadData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh('deliveryOrders'), refresh('drivers')]);
    } finally {
      setRefreshing(false);
    }
  };

  const deliveries = useMemo(() => (deliveryData || []).filter((item: any) => (
    normalizeVendorId(item.vendorId || item.vendor || '') === normalizedUserVendorId
  )), [deliveryData, normalizedUserVendorId]);

  const drivers = useMemo(() => (allDrivers || []).filter((item: any) => (
    normalizeVendorId(item.vendorId || item.vendor || '') === normalizedUserVendorId
  )), [allDrivers, normalizedUserVendorId]);
  const driverPhotos = useMemo(
    () => new Map(drivers.map((driver: any) => [String(driver.id || '').trim(), driver.photoURL || driver.photoUrl || ''])),
    [drivers],
  );

  const loading = deliveriesLoading;

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return deliveries
      .filter((d) => {
        const matchesSearch =
          !query ||
          [d.jobId, d.driverName, d.plateNumber, d.poNumber, d.materialName]
            .some((v) => String(v || '').toLowerCase().includes(query));

        if (filter === 'all') return matchesSearch;
        if (filter === 'active')
          return matchesSearch && isActiveJob(d.status);
        if (filter === 'completed')
          return matchesSearch && !isActiveJob(d.status) && normalizeJobStatus(d.status) !== 'CANCELLED';
        if (filter === 'cancelled') return matchesSearch && normalizeJobStatus(d.status) === 'CANCELLED';

        return matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      );
  }, [deliveries, search, filter]);

  const activeTrips = deliveries.filter(
    (d) => isActiveJob(d.status)
  ).length;
  const completedTrips = deliveries.filter((d) =>
    !isActiveJob(d.status) && normalizeJobStatus(d.status) !== 'CANCELLED'
  ).length;

  return (
    <PageShell
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
      }
    >
      <View style={styles.metricGrid}>
        <ResponsiveGrid sideBySide maxColumns={3} style={styles.metricRow}>
          <MetricTile icon="layers" label="Total" value={deliveries.length} tone={colors.primary} compact emphasized onPress={() => setFilter('all')} />
          <MetricTile icon="navigate-circle" label="Active" value={activeTrips} tone={colors.accent} compact emphasized onPress={() => setFilter('active')} />
          <MetricTile icon="checkmark-done-circle" label="Done" value={completedTrips} tone={colors.success} compact emphasized onPress={() => setFilter('completed')} />
        </ResponsiveGrid>
      </View>

      <SearchField title="Trips" icon="navigate-outline" value={search} onChangeText={setSearch} placeholder="Search job, driver, plate, PO..." />
      <FilterRail options={STATUS_FILTERS} value={filter} onChange={setFilter} />
      <View style={{ gap: 6 }}>
      <SectionTitle title={`${filtered.length} trips`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading trips...</Text></DataCard>
      ) : filtered.length ? (
        <View style={{ gap: 6 }}>{filtered.map((item) => (
            <TripListCard
              key={item.id}
              trip={item}
              driverPhoto={driverPhotos.get(String(item.driverId || '').trim())}
              onPress={() => router.push(`/screens/job-details?id=${item.jobId || item.id}` as any)}
            />
        ))}</View>
      ) : (
        <EmptyState icon="layers-outline" title="No trips" subtitle="No delivery trips found." />
      )}
      </View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricGrid: { gap: Gap },
  metricRow: { gap: Gap },
});
