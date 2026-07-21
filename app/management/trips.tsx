import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useDeliveryOrders } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { formatEAT } from '../../utils/helpers';
import { isActiveJob, normalizeJobStatus } from '../../utils/jobStatus';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

export default function ManagementTripsScreen() {
  const colors = useTheme();
  const deliveries = useDeliveryOrders();
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
    <PageShell
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search completed trips..."
      />
      <SectionTitle title={`${trips.length} completed trips`} />

      {trips.length ? (
        trips.map((item) => (
          <DataCard
            key={item.id}
            onPress={() => router.push(`/operations/jobs/${item.id}` as any)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeading}>
                <Text style={[styles.title, { color: colors.text }]}>{item.jobId || item.id}</Text>
                <Text style={[styles.reference, { color: colors.textMuted }]}>PO: {item.poNumber || 'N/A'}</Text>
              </View>
              <StatusPill status={item.status} />
            </View>
            <DetailRow
              icon="person-outline"
              value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No truck'}`}
            />
            <DetailRow icon="cube-outline" value={item.materialName || 'Material not specified'} />
            <Text style={[styles.date, { color: colors.textTertiary }]}>
              Completed {formatEAT(item.updatedAt || item.createdAt)}
            </Text>
          </DataCard>
        ))
      ) : (
        <EmptyState
          icon="checkmark-done-outline"
          title="No completed trips"
          subtitle="Completed delivery trips will appear here."
        />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardHeading: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800' },
  reference: { fontSize: 12, fontWeight: '600' },
  date: { fontSize: 12, marginTop: 2 },
});
