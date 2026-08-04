import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from '../../utils/router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useDeliveryOrders, useDrivers } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { isActiveJob, normalizeJobStatus } from '../../utils/jobStatus';
import { EmptyState, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { TripListCard } from '../../components/TripListCard';
import { ManagementSearchHeader } from '../../components/ManagementSearchHeader';

export default function ManagementTripsScreen() {
  const colors = useTheme();
  const deliveries = useDeliveryOrders();
  const drivers = useDrivers();
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const driverPhotos = useMemo(
    () => new Map(
      drivers.map((driver: any) => [
        String(driver.id || '').trim(),
        driver.photoURL || driver.photoUrl || '',
      ]),
    ),
    [drivers],
  );

  const trips = useMemo(() => {
    const query = search.trim().toLowerCase();

    return deliveries
      .filter((item) => {
        const status = normalizeJobStatus(item.status);
        return !isActiveJob(status) && status !== 'CANCELLED';
      })
      .filter((item) => {
        if (!query) return true;
        return [item.jobId, item.driverName, item.plateNumber, item.poNumber, item.materialName]
          .some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      );
  }, [deliveries, search]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh('deliveryOrders');
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return (
    <>
      <ManagementSearchHeader title="Trips" search={search} onChangeSearch={setSearch} placeholder="Search completed trips..." />

      <PageShell
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <SectionTitle title={`${trips.length} completed trips`} />

        {trips.length ? (
          <View style={styles.tripList}>
            {trips.map((item) => {
              const receiptJobId = item.jobId || item.id;
              const driverPhoto = driverPhotos.get(String(item.driverId || '').trim());
              return (
                <TripListCard
                  key={item.id}
                  trip={item}
                  driverPhoto={driverPhoto}
                  onPress={() => router.push(`/operations/jobs/${item.id}` as any)}
                  bottomAction={
                    <TouchableOpacity
                      style={[styles.receiptAction, { backgroundColor: '#10B98115', borderColor: '#10B98133' }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push(`/screens/receipt-note?id=${encodeURIComponent(receiptJobId)}` as any);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Open receipt note for ${receiptJobId}`}
                    >
                      <Text style={styles.receiptActionText}>Receipt Note</Text>
                      <Text style={styles.receiptNumber} numberOfLines={1}>
                        {item.receiptNoteId || receiptJobId}
                      </Text>
                    </TouchableOpacity>
                  }
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="checkmark-done-outline"
            title="No completed trips"
            subtitle="Completed delivery trips will appear here."
          />
        )}
      </PageShell>
    </>
  );
}

const styles = StyleSheet.create({
  tripList: { gap: 0.1 },
  receiptAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  receiptActionText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  receiptNumber: { color: '#059669', flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'right' },
});
