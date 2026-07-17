import { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { formatEAT } from '../../utils/helpers';
import { buildCsvContent, shareCsvAsFile } from '../../utils/exportData';
import { useDeliveryOrders } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import {
  DataCard,
  EmptyState,
  PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';

/* ─────────── Filter Options ─────────── */

type FilterPeriod = 'today' | 'week' | 'month';

const FILTER_LABELS: Record<FilterPeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
};

/* ─────────── Component ─────────── */

export default function OperatorQuarryHistoryScreen() {
  const colors = useTheme();
  const deliveries = useDeliveryOrders();
  const refresh = useRealTimeSyncStore((s) => s.refresh);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterPeriod>('today');

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh('deliveryOrders');
    setRefreshing(false);
  };

  useEffect(() => {
    // Initial fetch
    refresh('deliveryOrders');
    setLoading(false);
  }, []);

  // Auto-hide loading when realtime data arrives
  useEffect(() => {
    if (deliveries.length > 0) {
      setLoading(false);
    }
  }, [deliveries.length]);

  /* ─── Filtering Logic ─── */

  const now = new Date();

  const getStartOfPeriod = (period: FilterPeriod): Date => {
    const d = new Date(now);
    if (period === 'today') {
      d.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
    } else {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  };

  const startDate = getStartOfPeriod(filter);

  const activeQueue = useMemo(() => {
    return deliveries.filter(
      (d) => !['delivered', 'completed', 'loaded', 'cancelled'].includes(d.status),
    );
  }, [deliveries]);

  const completedRecords = useMemo(() => {
    return deliveries
      .filter(
        (d) =>
          d.status === 'delivered' || d.status === 'completed' || d.status === 'loaded',
      )
      .filter((d) => {
        const updated = new Date(d.updatedAt || d.createdAt);
        return updated >= startDate;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
  }, [deliveries, startDate]);

  /* ─── Export Logic ─── */

  const exportHeaders = [
    'Job ID',
    'PO Number',
    'Material',
    'Size/Grade',
    'Qty Loaded (t)',
    'Truck Plate',
    'Driver',
    'Quarry In-Time',
    'Quarry Out-Time',
    'Quarry Geolocation',
    'Operator',
  ];

  const buildExportRows = (records: any[]): string[][] =>
    records.map((r) => {
      const quarryNet =
        r.netWeight ??
        (r.weighInWeight != null && r.weighOutWeight != null
          ? r.weighOutWeight - r.weighInWeight
          : null);

      return [
        r.jobId || '',
        r.poNumber || '',
        r.materialName || '',
        r.materialSize || r.materialGrade || '—',
        quarryNet != null ? `${quarryNet.toFixed(1)}` : String(r.quantityOrdered ?? '—'),
        r.plateNumber || '',
        r.driverName || '',
        r.quarryInTime || (r.weighInTime ? new Date(r.weighInTime).toISOString() : '—'),
        r.quarryOutTime || (r.weighOutTime ? new Date(r.weighOutTime).toISOString() : '—'),
        r.weighOutGeoLocation?.address || r.weighOutLocation || r.quarryName || '—',
        r.operatorUsername || r.quarryOperator || '—',
      ];
    });

  const handleDownloadCSV = async () => {
    const rows = buildExportRows(completedRecords);
    const csvContent = buildCsvContent(exportHeaders, rows);
    await shareCsvAsFile(`Quarry_History_${FILTER_LABELS[filter]}`, csvContent);
  };

  /* ─── Per-Delivery Note Export ─── */

  const buildDeliveryNoteHeaders = () => [
    'Field', 'Value',
  ];

  const buildDeliveryNoteRows = (item: any): string[][] => [
    ['Job ID', item.jobId || ''],
    ['Purchase Order', item.poNumber || ''],
    ['Vendor', item.vendorName || ''],
    ['Driver', item.driverName || ''],
    ['Truck Plate', item.plateNumber || ''],
    ['Material', item.materialName || ''],
    ['Quantity Ordered', item.quantityOrdered != null ? `${item.quantityOrdered} tonnes` : '—'],
    ['Origin (Quarry)', item.quarryName || ''],
    ['Destination (Site)', item.siteName || ''],
    ['Weigh-In Weight', item.weighInWeight != null ? `${item.weighInWeight.toFixed(1)} t` : '—'],
    ['Weigh-Out Weight', item.weighOutWeight != null ? `${item.weighOutWeight.toFixed(1)} t` : '—'],
    ['Net Weight', item.netWeight != null ? `${item.netWeight.toFixed(1)} t` : '—'],
    ['Weigh-Out Location', item.weighOutGeoLocation?.address || item.weighOutLocation || '—'],
    ['Status', (item.status || '').replace(/_/g, ' ').toUpperCase()],
    ['Assigned At', item.createdAt || ''],
    ['Completed At', item.updatedAt || ''],
  ];

  const handleExportDeliveryNoteCSV = async (item: any) => {
    const headers = buildDeliveryNoteHeaders();
    const rows = buildDeliveryNoteRows(item);
    const csvContent = buildCsvContent(headers, rows);
    const safeName = `Delivery_Note_${item.jobId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    await shareCsvAsFile(safeName, csvContent);
  };

  /* ─── Summary Stats ─── */

  const totalNetToday = completedRecords.reduce(
    (sum, r) => sum + (r.netWeight || 0),
    0,
  );

  return (
    <PageShell
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {(['today', 'week', 'month'] as FilterPeriod[]).map((period) => {
          const active = filter === period;
          return (
            <TouchableOpacity
              key={period}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active
                    ? colors.primary
                    : colors.inputBg,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(period)}
            >
              <Ionicons
                name={
                  period === 'today'
                    ? 'today-outline'
                    : period === 'week'
                      ? 'calendar-outline'
                      : 'calendar-number-outline'
                }
                size={14}
                color={active ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterPillText,
                  { color: active ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {FILTER_LABELS[period]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Export Actions — CSV only */}
      <View style={styles.exportRow}>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: '#2563EB' }]}
          onPress={handleDownloadCSV}
        >
          <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
          <Text style={styles.exportBtnText}>Download CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Completed Submissions */}
      <SectionTitle
        title={`Completed — ${FILTER_LABELS[filter]} (${completedRecords.length})`}
      />
      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text>
        </DataCard>
      ) : completedRecords.length ? (
        completedRecords.map((item) => (
          <DataCard key={item.id}>
            <View style={styles.tableHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tableJobId, { color: colors.text }]}>
                  {item.jobId}
                </Text>
                <Text style={[styles.tablePo, { color: colors.textMuted }]}>
                  {item.poNumber || '—'}
                </Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCell}>
                <Text style={[styles.tableLabel, { color: colors.textMuted }]}>Driver</Text>
                <Text style={[styles.tableValue, { color: colors.text }]}>
                  {item.driverName || '—'}
                </Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={[styles.tableLabel, { color: colors.textMuted }]}>Truck</Text>
                <Text style={[styles.tableValue, { color: colors.text }]}>
                  {item.plateNumber || '—'}
                </Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCell}>
                <Text style={[styles.tableLabel, { color: colors.textMuted }]}>Material</Text>
                <Text style={[styles.tableValue, { color: colors.text }]}>
                  {item.materialName || '—'}
                </Text>
              </View>
            </View>

            {/* Weight Summary Row for Completed */}
            <View style={[styles.weightSummary, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <View style={styles.weightCell}>
                <Text style={[styles.wLabel, { color: colors.textMuted }]}>IN</Text>
                <Text style={[styles.wValue, { color: '#2563EB' }]}>
                  {item.weighInWeight != null ? `${item.weighInWeight.toFixed(1)}T` : '—'}
                </Text>
              </View>
              <View style={styles.weightCell}>
                <Text style={[styles.wLabel, { color: colors.textMuted }]}>OUT</Text>
                <Text style={[styles.wValue, { color: '#7C3AED' }]}>
                  {item.weighOutWeight != null ? `${item.weighOutWeight.toFixed(1)}T` : '—'}
                </Text>
              </View>
              <View style={styles.weightCell}>
                <Text style={[styles.wLabel, { color: colors.textMuted }]}>NET</Text>
                <Text style={[styles.wValue, { color: colors.success, fontSize: 18 }]}>
                  {item.netWeight != null ? `${item.netWeight.toFixed(1)}T` : '—'}
                </Text>
              </View>
            </View>

            {/* Location if available */}
            {item.weighOutGeoLocation?.address && (
              <View style={styles.locationTag}>
                <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                <Text style={[styles.locationTagText, { color: colors.textTertiary }]} numberOfLines={1}>
                  {item.weighOutGeoLocation.address}
                </Text>
              </View>
            )}

            {/* Per-Delivery Export Actions — CSV only */}
            <View style={styles.deliveryExportRow}>
              <TouchableOpacity
                style={[styles.deliveryExportBtn, { backgroundColor: '#2563EB12', borderColor: '#2563EB33' }]}
                onPress={() => handleExportDeliveryNoteCSV(item)}
              >
                <Ionicons name="document-text-outline" size={14} color="#2563EB" />
                <Text style={[styles.deliveryExportBtnText, { color: '#2563EB' }]}>CSV</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.tableTimestamp, { color: colors.textTertiary }]}>
              Completed: {formatEAT(item.updatedAt || item.createdAt)}
            </Text>
          </DataCard>
        ))
      ) : (
        <EmptyState
          icon="checkmark-done-outline"
          title="No completed records"
          subtitle={`No submissions found for ${FILTER_LABELS[filter].toLowerCase()}.`}
        />
      )}

      {/* Bottom spacing */}
      <View style={{ height: Spacing['4xl'] }} />
    </PageShell>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  // Filters
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13, fontWeight: '700' },
  // Export
  exportRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    minHeight: 44,
    paddingHorizontal: Spacing.xl,
  },
  exportBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  // Table rows
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  tableJobId: { fontSize: 15, fontWeight: '700' },
  tablePo: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  tableRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: 4,
  },
  tableCell: { flex: 1 },
  tableLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  tableValue: { fontSize: 13, fontWeight: '600' },
  tableTimestamp: { fontSize: 12, marginTop: Spacing.sm },
  // Weight summary for completed
  weightSummary: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  weightCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  wLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  wValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  // Location tag
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  locationTagText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  // Per-delivery export
  deliveryExportRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  deliveryExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  deliveryExportBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});