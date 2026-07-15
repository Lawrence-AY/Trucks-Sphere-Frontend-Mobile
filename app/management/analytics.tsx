import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';
import { fetchAnalyticsSummary } from '../../services/api';
import { CommandHeader, DataCard, DetailRow, MetricTile, PageShell, SectionTitle } from '../../components/EnterpriseUI';

export default function AnalyticsScreen() {
  const colors = useTheme();
  const [summary, setSummary] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      setSummary(await fetchAnalyticsSummary());
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const operations = summary.operations || {};
  const fleet = summary.fleet || {};
  const procurement = summary.procurement || {};

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
       

      <View style={styles.metrics}>
        <MetricTile icon="layers-outline" label="Total jobs" value={operations.totalJobs || 0} tone={colors.primary} />
        <MetricTile icon="pulse-outline" label="Active jobs" value={operations.activeJobs || 0} tone={colors.warning} />
      </View>
      <View style={styles.metrics}>
        <MetricTile icon="business-outline" label="Vendors" value={fleet.vendors || 0} tone={colors.success} />
        <MetricTile icon="document-text-outline" label="Purchase orders" value={procurement.purchaseOrders || 0} tone={colors.primary} />
      </View>

      <SectionTitle title="Operational Breakdown" />
      <DataCard>
        <Text style={[styles.title, { color: colors.text }]}>Jobs by status</Text>
        {Object.entries(operations.jobsByStatus || {}).map(([status, count]) => (
          <DetailRow key={status} icon="radio-button-on-outline" label={status} value={String(count)} />
        ))}
        {!Object.keys(operations.jobsByStatus || {}).length && (
          <DetailRow icon="information-circle-outline" value="No job status data available" />
        )}
      </DataCard>

      <DataCard>
        <Text style={[styles.title, { color: colors.text }]}>Fleet status</Text>
        <DetailRow icon="people-outline" label="Drivers" value={String(fleet.drivers || 0)} />
        <DetailRow icon="car-outline" label="Vehicles" value={String(fleet.vehicles || 0)} />
        <DetailRow icon="water-outline" label="Fuel records" value={String(summary.fuel?.records || 0)} />
      </DataCard>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: Spacing.sm },
  title: { fontSize: 16, fontWeight: '900' },
});
