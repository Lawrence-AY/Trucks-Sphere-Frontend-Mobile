import { useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDrivers } from '../../services/api';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
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

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
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
                {item.photoURL ? (
                  <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}
                    </Text>
                  </View>
                )}
                <View style={styles.cardCopy}>
                  <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
                  <Text style={[styles.subtle, { color: colors.textMuted }]}>{item.licenseNumber || 'No license number'}</Text>
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
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 48, height: 48, borderRadius: 16 },
  avatarText: { fontSize: 16, fontWeight: '900' },
  cardCopy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});