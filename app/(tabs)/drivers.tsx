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
} from '../../components/EnterpriseUI';

export default function DriversScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchDrivers()) || [];
      setDrivers(user?.role === 'vendor' ? data.filter((item: any) => item.vendorId === (user.vendorId || 'v1')) : data);
    } catch (error) {
      console.error('Drivers load error:', error);
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
    return drivers.filter((item) => !query || [item.name, item.fullName, item.phone, item.licenseNumber]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [drivers, search]);

  const expiring = drivers.filter((item) => {
    const expiry = new Date(item.licenseExpiry || item.licenseExpiryDate || '');
    return expiry.getTime() && expiry.getTime() < Date.now() + 60 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader eyebrow="Fleet workforce" title="Drivers" subtitle={`${drivers.length} drivers · ${expiring} license alerts`} />
      <View style={styles.metricRow}>
        <MetricTile icon="people" label="Active drivers" value={drivers.filter((item) => item.status === 'active').length} tone={colors.success} />
        <MetricTile icon="shield-checkmark" label="Compliance alerts" value={expiring} tone={expiring ? colors.warning : colors.accent} />
      </View>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search driver, phone, license..." />
      <SectionTitle title={`${filtered.length} driver records`} />

      {loading ? (
        <DataCard><Text style={[styles.muted, { color: colors.textMuted }]}>Loading drivers...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const name = item.name || item.fullName || 'Unnamed driver';
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/driver-history?id=${item.id}&name=${encodeURIComponent(name)}`)}>
              <View style={styles.cardHead}>
                <View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
                  <Text style={[styles.subtle, { color: colors.textMuted }]}>{item.licenseNumber || 'No license number'}</Text>
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
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900' },
  cardCopy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
