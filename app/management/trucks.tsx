import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchVehicles } from '../../services/api';
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

export default function ManagementTrucksScreen() {
  const colors = useTheme();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchVehicles()) || [];
      setVehicles(data);
    } catch (error) {
      console.error('Vehicles load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return vehicles.filter((item) => !query ||
      [item.plateNumber, item.model, item.make, item.driverName]
        .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [vehicles, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Fleet assets" title="Trucks" subtitle={`${vehicles.length} vehicles`} />
      <View style={styles.metricRow}>
        <MetricTile icon="car" label="Active" value={vehicles.filter((item) => item.status === 'active').length} tone={colors.success} />
        <MetricTile icon="car-sport" label="Total" value={vehicles.length} tone={colors.primary} />
      </View>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search plate, model..." />
      <SectionTitle title={`${filtered.length} vehicles`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading vehicles...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/truck-history?id=${item.id}` as any)}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.plateNumber}</Text>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.make} {item.model} ({item.year})</Text>
              </View>
              <StatusPill status={item.status || 'active'} compact />
            </View>
            <DetailRow icon="person-outline" value={`Driver: ${item.driverName || 'Unassigned'}`} />
            <DetailRow icon="business-outline" value={`Vendor: ${item.vendorName || 'Unassigned'}`} />
            <DetailRow icon="scale-outline" value={`Capacity: ${item.capacity || 'N/A'} tonnes`} />
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
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
});