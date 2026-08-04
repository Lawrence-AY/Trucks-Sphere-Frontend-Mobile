import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Searchbar } from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { useDeliveryOrders, useDrivers, useMaterials } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { syncDeliveryOrderWithOdoo } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import { isActiveJob } from '../../utils/jobStatus';
import {
  DataCard,
  EmptyState,
  FilterRail,
  PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';
import { TripListCard } from '../../components/TripListCard';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

function isFlagged(item: any) {
  const net = Number(item.netWeight || 0);
  return net > 0 && (net < 19 || net > 23);
}

function escapeCsvField(value: any): string {
  if (value == null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsv(headers: string[], rows: string[][]): string {
  const hdr = headers.map(escapeCsvField).join(',');
  const body = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
  return `${hdr}\n${body}`;
}

export default function ManagementActiveScreen() {
  const colors = useTheme();
  const refresh = useRealTimeSyncStore((s) => s.refresh);

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('');
  const [matDropdownOpen, setMatDropdownOpen] = useState(false);
  const [matSearch, setMatSearch] = useState('');
  const [syncingOdooIds, setSyncingOdooIds] = useState<string[]>([]);

  // Realtime hooks
  const deliveries = useDeliveryOrders();
  const drivers = useDrivers();
  const materials = useMaterials();

  const driverPhotos = useMemo(
    () =>
      new Map(
        drivers.map((driver: any) => [
          String(driver.id || '').trim(),
          driver.photoURL || driver.photoUrl || '',
        ])
      ),
    [drivers]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh('deliveryOrders'), refresh('materials')]);
    setRefreshing(false);
  }, [refresh]);

  const retryOdooReceiptSync = useCallback(async (deliveryId: string) => {
    setSyncingOdooIds((current) => [...current, deliveryId]);
    try {
      const updated = await syncDeliveryOrderWithOdoo(deliveryId);
      useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', updated);
      useRealTimeSyncStore.getState().invalidateETag('deliveryOrders');
      if (updated?.odooReceiptSyncStatus === 'failed') {
        Alert.alert('Odoo sync failed', 'Odoo did not accept the receipt yet. Check the receipt and try again.');
      }
    } catch {
      Alert.alert('Odoo sync failed', 'The receipt could not be synchronized. Please try again.');
    } finally {
      setSyncingOdooIds((current) => current.filter((id) => id !== deliveryId));
    }
  }, []);

  /* ─── Time Range Filtering ─── */
  const now = new Date();
  const getStartOfPeriod = (period: string): Date => {
    const d = new Date(now);
    if (period === 'today') {
      d.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    const periodStart = getStartOfPeriod(filter);

    return deliveries.filter((item) => {
      if (!isActiveJob(item.status)) return false;
      if (item.isBackorder) return false;
      if (!item.driverId && !item.driverName) return false;
      const matchesSearch = !query ||
        [
          item.jobId,
          item.poNumber,
          item.driverName,
          item.plateNumber,
          item.vendorName,
          item.materialName,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      if (!matchesSearch) return false;

      if (filter !== 'all') {
        const itemDate = new Date(item.updatedAt || item.createdAt);
        if (itemDate < periodStart) return false;
      }

      const matchesMaterial = !materialFilter || item.materialId === materialFilter;
      return matchesMaterial;
    });
  }, [deliveries, filter, search, materialFilter]);

  const matFiltered = matSearch.trim()
    ? materials.filter((m) => (m.name || '').toLowerCase().includes(matSearch.toLowerCase()))
    : materials;

  const selectedMaterial = materials.find((m) => m.id === materialFilter);

  /* ─── Counts for UI ─── */
  const flaggedCount = deliveries.filter(isFlagged).length;

  /* ─── Export Helpers ─── */
  const buildDeliveryRows = (records: any[]): string[][] =>
    records.map((r) => [
      r.jobId || '',
      r.poNumber || '',
      r.driverName || '',
      r.plateNumber || '',
      r.vendorName || '',
      r.materialName || '',
      String(r.quantityOrdered ?? ''),
      r.weighInWeight != null ? r.weighInWeight.toFixed(1) : '—',
      r.weighOutWeight != null ? r.weighOutWeight.toFixed(1) : '—',
      r.netWeight != null ? r.netWeight.toFixed(1) : '—',
      r.status || '',
      formatEAT(r.updatedAt || r.createdAt),
    ]);

  const deliveryHeaders = [
    'Job ID', 'PO', 'Driver', 'Plate', 'Vendor', 'Material',
    'Qty Ordered (t)', 'Weigh In', 'Weigh Out', 'Net', 'Status', 'Updated',
  ];

  const handleExportDeliveryCSV = async () => {
    const rows = buildDeliveryRows(filtered);
    await Share.share({
      message: formatCsv(deliveryHeaders, rows),
      title: 'Delivery_Orders',
    });
  };

  const handleExportDeliveryPDF = async () => {
    const rows = buildDeliveryRows(filtered);
    const headerCells = deliveryHeaders
      .map(
        (h) =>
          `<th style="padding:8px 10px;background:#1B2A4A;color:#fff;font-weight:700;text-align:left;border:1px solid #ddd;font-size:11px;">${h}</th>`
      )
      .join('');
    const bodyRows = rows
      .map((row, i) => {
        const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        const cells = row
          .map((cell) => `<td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;">${cell || '—'}</td>`)
          .join('');
        return `<tr style="background:${bg};">${cells}</tr>`;
      })
      .join('');
    const html = `<html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:16px;">
      <h1>Trucks Sphere — Delivery Orders</h1>
      <table style="width:100%;border-collapse:collapse;">${headerCells}${bodyRows}</table>
    </body></html>`;
    await Share.share({ message: html, title: 'Delivery_Orders' });
  };

  const isLoading = deliveries.length === 0 && materials.length === 0;

  return (
    <>
      <Tabs.Screen
        options={{
          title: 'Active Trips',
          headerTitleAlign: 'left',
          headerTitleContainerStyle: { left: 6, right: 174 },
          headerTitle: () => (
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              Active
            </Text>
          ),
          headerRight: () => (
            <Searchbar
              placeholder="Search..."
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              style={[styles.headerSearch, { backgroundColor: colors.inputBg }]}
              inputStyle={[styles.headerSearchInput, { color: colors.text }]}
            />
          ),
        }}
      />

      <PageShell
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Period Filter */}
        <FilterRail options={FILTERS} value={filter} onChange={setFilter} />

        {/* Material Filter */}
        <View style={{ marginBottom: Spacing.xs, marginTop: Spacing.xs }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 40,
              borderWidth: 1,
              borderRadius: Radius.md,
              paddingHorizontal: Spacing.md,
              gap: 6,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
            onPress={() => {
              setMatDropdownOpen(!matDropdownOpen);
              setMatSearch('');
            }}
          >
            <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
            <Text
              style={{ flex: 1, fontSize: 13, color: selectedMaterial ? colors.text : colors.textMuted }}
              numberOfLines={1}
            >
              {selectedMaterial ? selectedMaterial.name : 'Filter by material...'}
            </Text>
            {materialFilter ? (
              <TouchableOpacity onPress={() => setMaterialFilter('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name={matDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            )}
          </TouchableOpacity>
          {matDropdownOpen && (
            <View
              style={{
                borderWidth: 1,
                borderTopWidth: 0,
                borderBottomLeftRadius: Radius.md,
                borderBottomRightRadius: Radius.md,
                overflow: 'hidden',
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: Spacing.md,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  gap: 6,
                  borderBottomColor: colors.border,
                }}
              >
                <Ionicons name="search" size={14} color={colors.textMuted} />
                <TextInput
                  style={{ flex: 1, fontSize: 13, paddingVertical: 2, color: colors.text }}
                  placeholder="Search materials..."
                  placeholderTextColor={colors.textMuted}
                  value={matSearch}
                  onChangeText={setMatSearch}
                  autoFocus
                />
              </View>
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                {matFiltered.map((m: any) => (
                  <TouchableOpacity
                    key={m.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 10,
                      paddingHorizontal: Spacing.md,
                    }}
                    onPress={() => {
                      setMaterialFilter(m.id);
                      setMatDropdownOpen(false);
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {m.name || m.id}
                    </Text>
                    {m.id === materialFilter && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <SectionTitle title={`${filtered.length} active deliveries`} />
        {isLoading ? (
          <DataCard>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>Loading movement board...</Text>
          </DataCard>
        ) : filtered.length ? (
          <View style={styles.activeTripList}>
            {filtered.map((item) => {
              const driverPhoto = driverPhotos.get(String(item.driverId || '').trim());
              return (
                <TripListCard
                  key={item.id}
                  trip={item}
                  driverPhoto={driverPhoto}
                  onPress={() => router.push(`/operations/jobs/${item.id}` as any)}
                  bottomAction={item.odooReceiptSyncStatus === 'failed' ? (
                    <TouchableOpacity
                      style={[styles.odooRetry, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        void retryOdooReceiptSync(item.id);
                      }}
                      disabled={syncingOdooIds.includes(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Retry Odoo receipt synchronization for ${item.jobId || item.id}`}
                    >
                      {syncingOdooIds.includes(item.id)
                        ? <ActivityIndicator size="small" color="#B91C1C" />
                        : <Ionicons name="refresh-outline" size={15} color="#B91C1C" />}
                      <Text style={styles.odooRetryText}>{syncingOdooIds.includes(item.id) ? 'Retrying Odoo sync...' : 'Retry Odoo receipt sync'}</Text>
                    </TouchableOpacity>
                  ) : undefined}
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="file-tray-outline"
            title="No deliveries found"
            subtitle="Try a broader search or another filter."
          />
        )}
      </PageShell>
    </>
  );
}

const styles = StyleSheet.create({
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSearch: {
    width: 250,
    height: 38,
    marginRight: '20%',
    borderRadius: Radius.md,
    elevation: 0,
  },
  headerSearchInput: {
    minHeight: 0,
    fontSize: 14,
  },
  activeTripList: {
    gap: 0.1,
  },
  odooRetry: { minHeight: 34, marginTop: Spacing.xs, borderWidth: 1, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: Spacing.sm },
  odooRetryText: { color: '#B91C1C', fontSize: 11, fontWeight: '800' },
});
