import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

export default function OperatorQuarryWeighOutScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchDeliveryOrders()) || [];
      setDeliveries(data.filter((d: any) => d.weighInWeight && !d.weighOutWeight && !['delivered', 'completed', 'cancelled'].includes(d.status)));
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter((d) => !q || [d.jobId, d.driverName, d.plateNumber].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [deliveries, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Quarry gate" title="Weigh Out" subtitle={`${deliveries.length} pending weigh-outs`} />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
      <SectionTitle title={`${filtered.length} to weigh out`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/weigh_out?id=${item.jobId}` as any)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text>
              <StatusPill status={item.status} compact />
            </View>
            <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
            <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="arrow-up-outline" title="No weigh-outs pending" subtitle="All weighed-in trucks have been weighed out." />
      )}
    </PageShell>
  );
}