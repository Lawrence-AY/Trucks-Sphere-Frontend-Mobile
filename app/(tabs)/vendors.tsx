import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { fetchDrivers, fetchVendors, fetchVehicles } from '../../services/api';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  ProgressBar,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

export default function VendorsScreen() {
  const colors = useTheme();
  const [vendors, setVendors] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [vendorData, driverData, vehicleData] = await Promise.all([fetchVendors(), fetchDrivers(), fetchVehicles()]);
      setVendors(vendorData || []);
      setDrivers(driverData || []);
      setVehicles(vehicleData || []);
    } catch (error) {
      console.error('Vendors load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return vendors.filter((item) => !query || [item.name, item.phone, item.email]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [search, vendors]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="External capacity" title="Vendors" subtitle="Vendors are managed entities, not app login users." />
      <View style={styles.metricRow}>
        <MetricTile icon="briefcase" label="Vendors" value={vendors.length} tone={colors.primary} />
        <MetricTile icon="car" label="Linked vehicles" value={vehicles.length} tone={colors.accent} />
      </View>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search vendor, phone, email..." />
      <SectionTitle title={`${filtered.length} vendor records`} />

      {loading ? (
        <DataCard><Text style={[styles.muted, { color: colors.textMuted }]}>Loading vendors...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const vendorDrivers = drivers.filter((driver) => driver.vendorId === item.id).length;
          const vendorVehicles = vehicles.filter((vehicle) => vehicle.vendorId === item.id).length;
          const utilization = Math.min(100, Math.round(((vendorDrivers + vendorVehicles) / 10) * 100));
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/vendor-detail?id=${item.id}&name=${encodeURIComponent(item.name || 'Vendor')}`)}>
              <View style={styles.cardHead}>
                <View style={[styles.avatar, { backgroundColor: `${colors.accent}18` }]}>
                  <Text style={[styles.avatarText, { color: colors.accent }]}>
                    {(item.name || 'V').split(' ').map((part: string) => part[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.subtle, { color: colors.textMuted }]}>{item.email || item.phone || 'No contact'}</Text>
                </View>
                <StatusPill status={item.status || 'active'} compact />
              </View>
              <ProgressBar value={utilization} color={colors.accent} />
              <DetailRow icon="people-outline" value={`${vendorDrivers} drivers`} />
              <DetailRow icon="car-outline" value={`${vendorVehicles} vehicles`} />
              <DetailRow icon="call-outline" value={item.phone || 'No phone'} />
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="briefcase-outline" title="No vendors found" subtitle="Try another search term." />
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
