import { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { fetchFuelRecords } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function FuelScreen() {
  const colors = useTheme();
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchFuelRecords()) || [];
      setRecords(data);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(
      (r) => !q || [r.jobId, r.driverName, r.plateNumber, r.vendorName].some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [records, search]);

  const totalFuel = useMemo(() => records.reduce((s, r) => s + (r.fuelAmount || 0), 0), [records]);
  const uniqueTrucks = useMemo(() => new Set(records.map((r) => r.plateNumber)).size, [records]);

  return (
    <PageShell
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}
    >
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="water" size={18} color="#F59E0B" />
          <Text style={[styles.statValue, { color: colors.text }]}>{totalFuel.toFixed(1)} L</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Fuel</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="car-outline" size={18} color="#3B82F6" />
          <Text style={[styles.statValue, { color: colors.text }]}>{uniqueTrucks}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Trucks Served</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="receipt-outline" size={18} color="#10B981" />
          <Text style={[styles.statValue, { color: colors.text }]}>{records.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Records</Text>
        </View>
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate..." />
      <SectionTitle title={`All Fuel Records (${filtered.length})`} />

      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#F59E0B' }}>{item.fuelId || item.id || item.jobId}</Text>
              <View style={[styles.fuelBadge, { backgroundColor: '#F59E0B15' }]}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#F59E0B' }}>{item.fuelAmount?.toFixed(1)} L</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: Spacing.sm }}>Job: {item.jobId}</Text>
            <DetailRow icon="person-outline" value={`${item.driverName || 'N/A'} · ${item.plateNumber || 'N/A'}`} />
            <DetailRow icon="business-outline" value={`Vendor: ${item.vendorName || 'N/A'}`} />
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: Spacing.sm }}>
              Dispensed: {formatEAT(item.dispensedAt || item.createdAt)}
            </Text>
          </DataCard>
        ))
      ) : (
        <EmptyState icon="water-outline" title="No fuel records" subtitle="No fuel has been dispensed yet." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: Spacing.md, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  fuelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
});