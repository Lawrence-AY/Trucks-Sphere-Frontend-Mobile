import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchFuelRecords } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  FilterRail,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';
import { Spacing } from '../../constants/theme';

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
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [deliveryData, fuelData] = await Promise.all([
        fetchDeliveryOrders(),
        fetchFuelRecords(),
      ]);
      setDeliveries((deliveryData || []).filter((d: any) => d.vendorId === vendorId));
      setFuelRecords(fuelData || []);
    } catch (error) {
      console.error('Vendor trips error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
          return matchesSearch && !['completed', 'delivered', 'received', 'cancelled'].includes(d.status);
        if (filter === 'completed')
          return matchesSearch && ['completed', 'delivered', 'received'].includes(d.status);
        if (filter === 'cancelled') return matchesSearch && d.status === 'cancelled';

        return matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      );
  }, [deliveries, search, filter]);

  const activeTrips = deliveries.filter(
    (d) => !['completed', 'delivered', 'received', 'cancelled'].includes(d.status)
  ).length;
  const completedTrips = deliveries.filter((d) =>
    ['completed', 'delivered', 'received'].includes(d.status)
  ).length;

  const getJobFuel = (jobId: string) => {
    return fuelRecords
      .filter((f) => f.jobId === jobId)
      .reduce((sum, f) => sum + (f.fuelAmount || 0), 0);
  };

  return (
    <PageShell
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
      }
    >
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="layers-outline" size={18} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>{deliveries.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="car-outline" size={18} color="#F59E0B" />
          <Text style={[styles.statValue, { color: colors.text }]}>{activeTrips}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="checkmark-done-outline" size={18} color="#10B981" />
          <Text style={[styles.statValue, { color: colors.text }]}>{completedTrips}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Done</Text>
        </View>
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate, PO..." />
      <FilterRail options={STATUS_FILTERS} value={filter} onChange={setFilter} />
      <SectionTitle title={`${filtered.length} trips`} />

      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading trips...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const jobFuel = getJobFuel(item.jobId || '');
          return (
            <DataCard
              key={item.id}
              onPress={() =>
                router.push(`/screens/job-details?id=${item.jobId || item.id}` as any)
              }
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                    {item.jobId || item.id}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                    PO: {item.poNumber || 'N/A'}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </View>
              <DetailRow
                icon="person-outline"
                value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No truck'}`}
              />
              <DetailRow
                icon="cube-outline"
                value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} ${item.unit || 'tonnes'}`}
              />
              {jobFuel > 0 && (
                <View style={[styles.fuelRow, { backgroundColor: '#F59E0B10' }]}>
                  <Ionicons name="water-outline" size={13} color="#F59E0B" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>
                    {jobFuel.toFixed(1)} L fuel dispensed
                  </Text>
                </View>
              )}
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                {formatEAT(item.updatedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="layers-outline" title="No trips" subtitle="No delivery trips found." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  statChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  fuelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
});