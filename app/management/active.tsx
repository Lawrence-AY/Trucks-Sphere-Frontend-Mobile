import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  FilterRail,
  PageShell,
  ProgressBar,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'weighbridge', label: 'Weighbridge' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'flagged', label: 'Flagged' },
];

function progressForDelivery(item: any) {
  if (item.status === 'delivered' || item.status === 'completed') return 100;
  if (item.receivedAt) return 92;
  if (item.deliveredAt) return 78;
  if (item.weighOutWeight || item.status === 'in_transit_to_site') return 58;
  if (item.weighInWeight || item.status === 'at_quarry') return 38;
  if (item.driverId || item.vehicleId || item.status === 'assigned') return 18;
  return 8;
}

function isFlagged(item: any) {
  const net = Number(item.netWeight || 0);
  return net > 0 && (net < 19 || net > 23);
}

export default function ManagementActiveScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = await fetchDeliveryOrders();
      setDeliveries(data || []);
    } catch (error) {
      console.error('Active deliveries load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return deliveries.filter((item) => {
      const matchesSearch = !query || [
        item.jobId, item.poNumber, item.driverName, item.plateNumber, item.vendorName, item.materialName,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      if (!matchesSearch) return false;
      if (filter === 'active') return !['delivered', 'completed', 'cancelled'].includes(item.status);
      if (filter === 'weighbridge') return Boolean(item.weighInWeight || item.weighOutWeight);
      if (filter === 'delivered') return ['delivered', 'completed'].includes(item.status);
      if (filter === 'flagged') return isFlagged(item);
      return true;
    });
  }, [deliveries, filter, search]);

  const activeCount = deliveries.filter((item) => !['delivered', 'completed', 'cancelled'].includes(item.status)).length;

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader title="Active board" subtitle={`${activeCount} in motion`} />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate, vendor..." />
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />
      <SectionTitle title={`${filtered.length} deliveries`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading movement board...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const progress = progressForDelivery(item);
          const flagged = isFlagged(item);
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId}` as any)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.vendorName || item.poNumber}</Text>
                </View>
                <StatusPill status={flagged ? 'suspended' : item.status} compact />
              </View>
              <ProgressBar value={progress} color={flagged ? colors.danger : colors.accent} />
              <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No truck'}`} />
              <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
              <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} → ${item.siteName || 'Destination'}`} />
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="file-tray-outline" title="No deliveries found" subtitle="Try a broader search or another filter." />
      )}
    </PageShell>
  );
}