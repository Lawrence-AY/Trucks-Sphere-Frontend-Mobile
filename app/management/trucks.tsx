import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Gap, Spacing } from '../../constants/theme';
import { fetchVehicles, fetchVendors } from '../../services/api';
import { useAuthStore } from '@/store/authStore';
import { hasManagementPermission } from '../../utils/access';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
} from '../../components/EnterpriseUI';
import { ManagementSearchHeader } from '../../components/ManagementSearchHeader';
import DesktopRecords from '../../components/DesktopRecords';
import { useDesktopWeb } from '../../hooks/useDesktopWeb';

export default function ManagementTrucksScreen() {
  const desktop = useDesktopWeb();
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const user = useAuthStore((state) => state.user);
  const canWriteTrucks = hasManagementPermission(user?.role, 'trucks.write');
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

  if (desktop) return <DesktopRecords title="Trucks" records={filtered} search={search} onSearch={setSearch} loading={loading} refreshing={refreshing} onRefresh={loadData}
    createHref={canWriteTrucks ? '/management/vehicles/create' : undefined} createLabel="Add truck"
    recordHref={item => `/management/vehicles/${encodeURIComponent(item.id)}`}
    columns={[
      { key: 'plate', label: 'Registration', value: item => item.registrationNumber || item.plateNumber || item.id },
      { key: 'model', label: 'Make / model', value: item => [item.make, item.model].filter(Boolean).join(' ') },
      { key: 'vendor', label: 'Vendor', value: getVendorName },
      { key: 'driver', label: 'Assigned driver', value: item => item.currentDriverName || item.driverName || 'Unassigned' },
      { key: 'capacity', label: 'Capacity', value: item => `${item.capacity ?? '—'} ${item.capacityUnit || ''}` },
      { key: 'status', label: 'Status', value: item => item.status || '—' },
    ]} />;

  return (
    <View style={styles.container}>
      <ManagementSearchHeader title="Trucks" search={search} onChangeSearch={setSearch} placeholder="Search plate, model..." />
      <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
        {loading ? (
          <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading vehicles...</Text></DataCard>
        ) : filtered.length ? (
          <View style={styles.cardList}>
          {filtered.map((item) => (
            <DataCard key={item.id} onPress={() => router.push(`/management/vehicles/${item.id}` as any)}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.plateNumber}</Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>{[item.make, item.model].filter(Boolean).join(' ')}{item.year ? ` (${item.year})` : ''}</Text>
                </View>
              </View>
              {item.driverName ? <DetailRow icon="person-outline" value={`Driver: ${item.driverName}`} /> : null}
              {getVendorName(item) ? <DetailRow icon="business-outline" value={`Vendor: ${getVendorName(item)}`} /> : null}
            </DataCard>
          ))}
          </View>
        ) : (
          <EmptyState icon="car-outline" title="No vehicles found" subtitle="Try another search term." />
        )}
      </PageShell>

      {canWriteTrucks ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/management/vehicles/create' as any)}
          activeOpacity={0.85}
          accessibilityLabel="Add truck"
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
          <Text style={styles.fabText}>Add Truck</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: { flex: 1 },
  cardList: { gap: Gap},
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Gap},
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Gap,
    borderRadius: 26,
    elevation: 0,
    shadowColor: colors.shadow,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },
});
