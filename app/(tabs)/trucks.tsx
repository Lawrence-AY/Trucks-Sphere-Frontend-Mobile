import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchVehicles } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

export default function TrucksScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchVehicles()) || [];
      setTrucks(user?.role === 'vendor' ? data.filter((item: any) => item.vendorId === (user.vendorId || 'v1')) : data);
    } catch (error) {
      console.error('Trucks load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role, user?.vendorId]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return trucks.filter((item) => !query || [item.plateNumber, item.registrationNumber, item.make, item.model]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [search, trucks]);

  const capacity = trucks.reduce((sum, item) => sum + Number(item.capacity || 0), 0);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Fleet assets" title="Vehicles" subtitle={`${Math.round(capacity)} tonnes total registered capacity`} />
      <View style={styles.metricRow}>
        <MetricTile icon="car" label="Active vehicles" value={trucks.filter((item) => item.status === 'active').length} tone={colors.success} />
        <MetricTile icon="construct" label="Unavailable" value={trucks.filter((item) => item.status !== 'active').length} tone={colors.warning} />
      </View>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search plate, make, model..." />
      <SectionTitle title={`${filtered.length} vehicle records`} />

      {loading ? (
        <DataCard><Text style={[styles.muted, { color: colors.textMuted }]}>Loading vehicles...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id}>
            <View style={styles.cardHead}>
              <View style={[styles.avatar, { backgroundColor: `${colors.warning}18` }]}>
                <Text style={[styles.avatarText, { color: colors.warning }]}>
                  {(item.plateNumber || item.registrationNumber || 'TR').slice(0, 2)}
                </Text>
              </View>
              <View style={styles.cardCopy}>
                <Text style={[styles.title, { color: colors.text }]}>{item.plateNumber || item.registrationNumber}</Text>
                <Text style={[styles.subtle, { color: colors.textMuted }]}>{item.make} {item.model} {item.year ? `· ${item.year}` : ''}</Text>
              </View>
              <StatusPill status={item.status || 'active'} compact />
            </View>
            <DetailRow icon="speedometer-outline" value={`${item.capacity || 0} tonnes capacity`} />
            <DetailRow icon="business-outline" value={item.vendorName || item.vendorId || 'Vendor not linked'} />
            <DetailRow icon="document-text-outline" value={`Insurance ${item.insuranceExpiry ? formatDate(item.insuranceExpiry) : 'not recorded'}`} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="car-outline" title="No vehicles found" subtitle="Try another search term." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900' },
  cardCopy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
