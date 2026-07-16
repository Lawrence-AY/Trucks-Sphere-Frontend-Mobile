import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchVehicles, fetchVendors } from '../../services/api';
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function ManagementTrucksScreen() {
  const colors = useTheme();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [vehicleData, vendorData] = await Promise.all([fetchVehicles(), fetchVendors()]);
      setVehicles(vehicleData || []);
      setVendors(vendorData || []);
    } catch (error) {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const vendorMap: Record<string, string> = {};
  vendors.forEach((v: any) => {
    vendorMap[v.id] = v.companyName || v.name || v.id;
    if (v.vendorId) vendorMap[v.vendorId] = v.companyName || v.name || v.vendorId;
  });

  const getVendorName = (vehicle: any): string => {
    if (vehicle.vendorName) return vehicle.vendorName;
    if (vehicle.vendorId && vendorMap[vehicle.vendorId]) return vendorMap[vehicle.vendorId];
    if (vehicle.vendorId) {
      const matched = vendors.find((v: any) =>
        v.id === vehicle.vendorId || v.vendorId === vehicle.vendorId
      );
      if (matched) return matched.companyName || matched.name || vehicle.vendorId;
    }
    return vehicle.vendorId || '';
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return vehicles.filter((item) => !query ||
      [item.plateNumber, item.model, item.make, item.driverName, getVendorName(item)]
        .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [vehicles, search, vendors]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search plate, model..." />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading vehicles...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/truck-history?id=${item.id}&plate=${encodeURIComponent(item.plateNumber || item.plate || '')}` as any)}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.plateNumber}</Text>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.make} {item.model} ({item.year})</Text>
              </View>
            </View>
            {item.driverName ? <DetailRow icon="person-outline" value={`Driver: ${item.driverName}`} /> : null}
            {getVendorName(item) ? <DetailRow icon="business-outline" value={`Vendor: ${getVendorName(item)}`} /> : null}
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