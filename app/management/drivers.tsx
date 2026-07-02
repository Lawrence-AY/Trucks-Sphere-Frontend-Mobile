import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDrivers } from '../../services/api';
import {
   DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function ManagementDriversScreen() {
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
    return result;
  }, [drivers, search]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
       <SearchField value={search} onChangeText={setSearch} placeholder="Search driver, phone, license..." />
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
              </View>
              <DetailRow icon="call-outline" value={item.phone || 'No phone'} />
              <DetailRow icon="business-outline" value={item.vendorName || item.vendorId || 'Vendor not linked'} />
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
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});