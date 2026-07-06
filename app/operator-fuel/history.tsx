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
  FilterRail,
} from '../../components/EnterpriseUI';

 

export default function FuelHistoryScreen() {
  const colors = useTheme();
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
    let result = records.filter(
      (r) => !q || [r.jobId, r.driverName, r.plateNumber, r.vendorName].some((v) => String(v || '').toLowerCase().includes(q)),
    );
   
    return result;
  }, [records, search, statusFilter]);

 

  return (
    <PageShell
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}
    >
       

      
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const isComplete = item.completed === true;
          return (
            <DataCard key={item.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: isComplete ? '#10B981' : '#F59E0B' }}>
                    {item.fuelId || item.id || item.jobId}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 1 }}>
                    Job: {item.jobId}
                  </Text>
                </View>
                <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {item.fuelAmount > 0 ? (
                    <View style={[styles.fuelBadge, { backgroundColor: '#F59E0B15' }]}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#F59E0B' }}>
                        {item.fuelAmount?.toFixed(1)} L
                      </Text>
                    </View>
                  ) : null}
                  
                </View>
              </View>
              <DetailRow icon="person-outline" value={`${item.driverName || 'N/A'} · ${item.plateNumber || 'N/A'}`} />
              <DetailRow icon="business-outline" value={`Vendor: ${item.vendorName || 'N/A'}`} />
              {item.pricePerLiter ? (
                <>
                  <DetailRow icon="cash-outline" value={`${item.pricePerLiter?.toFixed(2)} KES/L`} />
                  {item.totalCost ? (
                    <DetailRow icon="wallet-outline" value={`Total: KES ${item.totalCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                  ) : null}
                </>
              ) : null}
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: Spacing.sm }}>
                Dispensed: {formatEAT(item.dispensedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="water-outline" title="No fuel records" subtitle="No fuel records found." />
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
