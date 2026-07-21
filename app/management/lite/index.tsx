import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { Radius, Spacing } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { MetricTile, PageShell, SectionTitle } from '../../../components/EnterpriseUI';
import { useRealtimeCollection } from '../../../store/realtimeData';
import { useRealTimeSyncStore } from '../../../store/realTimeSyncStore';

const modules = [
  { title: 'Vendors', subtitle: 'View registered vendors', icon: 'business-outline', route: '/management/vendors', createRoute: '/management/vendors/create', createLabel: 'Add vendor' },
  { title: 'Trucks', subtitle: 'View registered trucks', icon: 'car-outline', route: '/management/trucks', createRoute: '/management/vehicles/create', createLabel: 'Add truck' },
  { title: 'Drivers', subtitle: 'View registered drivers', icon: 'people-outline', route: '/management/drivers', createRoute: '/management/drivers/create', createLabel: 'Add driver' },
];

export function ManagementLiteDashboard() {
  const colors = useTheme();
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const [refreshing, setRefreshing] = useState(false);
  const { data: vendors } = useRealtimeCollection('vendors');
  const { data: vehicles } = useRealtimeCollection('vehicles');
  const { data: drivers } = useRealtimeCollection('drivers');

  const totals = useMemo(() => ({
    vendors: vendors.length,
    trucks: vehicles.length,
    drivers: drivers.length,
  }), [drivers.length, vehicles.length, vendors.length]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh('vendors'), refresh('vehicles'), refresh('drivers')]);
    setRefreshing(false);
  }, [refresh]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
      <SectionTitle title="Fleet overview" />
      <Text style={[styles.intro, { color: colors.textMuted }]}>Manage your vendors, trucks, and drivers from one place.</Text>
      <View style={styles.metricRow}>
        <MetricTile icon="business" label="Vendors" value={totals.vendors} tone={colors.warning} onPress={() => router.push('/management/vendors' as any)} />
        <MetricTile icon="car" label="Trucks" value={totals.trucks} tone={colors.accent} onPress={() => router.push('/management/trucks' as any)} />
        <MetricTile icon="people" label="Drivers" value={totals.drivers} tone="#8B5CF6" onPress={() => router.push('/management/drivers' as any)} />
      </View>
      <SectionTitle title="Fleet records" />
      {modules.map((item) => (
        <View key={item.title} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.push(item.route as any)} style={styles.cardMain}>
            <View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}><Ionicons name={item.icon as any} size={22} color={colors.primary} /></View>
            <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.text }]}>{item.title}</Text><Text style={{ color: colors.textMuted }}>{item.subtitle}</Text></View>
          </TouchableOpacity>
          <Button title={item.createLabel} size="sm" icon="add" onPress={() => router.push(item.createRoute as any)} />
        </View>
      ))}
    </PageShell>
  );
}

export default function ManagementLiteHome() {
  return <ManagementLiteDashboard />;
}

const styles = StyleSheet.create({
  intro: { marginTop: -Spacing.xs, marginBottom: Spacing.sm, fontSize: 14 },
  metricRow: { flexDirection: 'row', gap: Spacing.xs },
  card: { minHeight: 82, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
});
