import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDrivers } from '../../services/api';
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
  FilterRail,
} from '../../components/EnterpriseUI';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const MATERIAL_FILTERS = [
  { key: 'all', label: 'All Materials' },
  { key: 'sand', label: 'Sand' },
  { key: 'ballast', label: 'Ballast' },
  { key: 'cement', label: 'Cement' },
  { key: 'hardcore', label: 'Hardcore' },
];

export default function ManagementDriversScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchDrivers()) || [];
      setDrivers(data);
    } catch (error) {
      console.error('Drivers load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    let result = drivers.filter((item) => !query || [item.name, item.fullName, item.phone, item.licenseNumber]
      .some((value) => String(value || '').toLowerCase().includes(query)));
    if (filter === 'active') result = result.filter((item) => item.status === 'active');
    if (filter === 'inactive') result = result.filter((item) => item.status !== 'active');
    return result;
  }, [drivers, search, filter]);

  const activeCount = drivers.filter((item) => item.status === 'active').length;
  const inactiveCount = drivers.filter((item) => item.status !== 'active').length;

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Fleet workforce" title="Drivers" subtitle={`${drivers.length} drivers · ${activeCount} active · ${inactiveCount} inactive`} />
      <View style={styles.metricRow}>
        <MetricTile icon="people" label="Active drivers" value={activeCount} tone={colors.success} />
        <MetricTile icon="person-remove" label="Inactive" value={inactiveCount} tone={colors.textMuted} />
      </View>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search driver, phone, license..." />
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />
      <FilterRail options={MATERIAL_FILTERS} value={materialFilter} onChange={setMaterialFilter} />
      <SectionTitle title={`${filtered.length} driver records`} />

      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading drivers...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const name = item.name || item.fullName || 'Unnamed driver';
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/driver-history?id=${item.id}&name=${encodeURIComponent(name)}` as any)}>
              <View style={styles.cardHead}>
                <View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>
                    {name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{name}</Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.licenseNumber || 'No license number'}</Text>
                </View>
                <StatusPill status={item.status || 'active'} compact />
              </View>
              <DetailRow icon="call-outline" value={item.phone || 'No phone'} />
              <DetailRow icon="business-outline" value={item.vendorName || item.vendorId || 'Vendor not linked'} />
              <DetailRow icon="calendar-outline" value={`License expires ${formatDate(item.licenseExpiry || item.licenseExpiryDate || new Date())}`} />
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="people-outline" title="No drivers found" subtitle="Try another search term." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});