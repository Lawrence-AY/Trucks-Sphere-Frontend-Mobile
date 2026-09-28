import { readableTextColor } from '../../utils/contrast';
import { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { router } from '../../utils/router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import {
  useDeliveryOrders,
  useDrivers,
  useVehicles,
  useVendors,
  useMaterials,
  usePurchaseOrders,
  useFuelRecords,
} from '@/store/realtimeData';
import { useRealTimeSyncStore } from '@/store/realTimeSyncStore';
import { downloadReportExcel, downloadCategoryCSV } from '../../services/api';
import { PageShell, SectionTitle } from '../../components/EnterpriseUI';

const FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];
const CATEGORIES = [
  { key: 'deliveries', label: 'Deliveries', icon: 'cube-outline', color: '#2563EB' },
  { key: 'fuel', label: 'Fuel', icon: 'water-outline', color: '#F59E0B' },
  { key: 'vendors', label: 'Vendors', icon: 'business-outline', color: '#8B5CF6' },
  { key: 'trucks', label: 'Trucks', icon: 'car-outline', color: '#EC4899' },
  { key: 'drivers', label: 'Drivers', icon: 'people-outline', color: '#10B981' },
  { key: 'materials', label: 'Materials', icon: 'layers-outline', color: '#6366F1' },
  { key: 'purchaseOrders', label: 'POs', icon: 'document-text-outline', color: '#0EA5E9' },
  { key: 'quarryOps', label: 'Quarry Ops', icon: 'hammer-outline', color: '#D97706' },
  { key: 'warehouse', label: 'Warehouse', icon: 'cube-outline', color: '#7C3AED' },
  { key: 'siteOps', label: 'Site Ops', icon: 'business-outline', color: '#059669' },
  { key: 'inspections', label: 'Inspections', icon: 'clipboard-outline', color: '#0F766E' },
  { key: 'storeActivity', label: 'Store Activity', icon: 'archive-outline', color: '#7C3AED' },
];

function withinTimeframe(dateStr: string, flt: string): boolean {
  if (!dateStr || flt === 'all') return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (flt) {
    case 'day':
      return d >= todayStart;
    case 'week': {
      const ws = new Date(todayStart);
      ws.setDate(ws.getDate() - ws.getDay() + 1);
      return d >= ws;
    }
    case 'month':
      return d >= new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return true;
  }
}

export default function ReportsScreen() {
  const colors = useTheme();
  const refresh = useRealTimeSyncStore((s) => s.refresh);

  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('deliveries');
  const [exporting, setExporting] = useState(false);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Realtime hooks
  const deliveries = useDeliveryOrders();
  const drivers = useDrivers();
  const vehicles = useVehicles();
  const vendors = useVendors();
  const materials = useMaterials();
  const purchaseOrders = usePurchaseOrders();
  const fuelRecords = useFuelRecords();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refresh('deliveryOrders'),
      refresh('drivers'),
      refresh('vehicles'),
      refresh('vendors'),
      refresh('materials'),
      refresh('purchaseOrders'),
      refresh('fuelRecords'),
    ]);
    setRefreshing(false);
  }, [refresh]);

  const metrics = useMemo(() => {
    const fDel = deliveries.filter((d) =>
      withinTimeframe(d.createdAt || d.updatedAt, filter)
    );
    const fFuel = fuelRecords.filter((r) =>
      withinTimeframe(r.createdAt || r.timestamp || r.dispensedAt, filter)
    );
    const fuelByJob: Record<string, { totalLitres: number; attendantName: string }> = {};
    fFuel.forEach((f: any) => {
      const jobId = f.jobId;
      if (jobId) {
        if (!fuelByJob[jobId]) fuelByJob[jobId] = { totalLitres: 0, attendantName: '' };
        fuelByJob[jobId].totalLitres += Number(f.litres || f.fuelAmount || 0);
        fuelByJob[jobId].attendantName =
          fuelByJob[jobId].attendantName || f.attendantName || f.dispensedBy || '';
      }
    });
    return {
      deliveries: {
        total: fDel.length,
        totalTonnage: fDel.reduce((s, d) => s + (Number(d.netWeight) || Number(d.quantityDelivered) || 0), 0),
        completed: fDel.filter((d) => ['completed', 'delivered'].includes(d.status)).length,
        inTransit: fDel.filter((d) =>
          ['loaded', 'dispatched', 'in_transit', 'en_route'].includes(d.status)
        ).length,
        preview: fDel.slice(0, 5),
      },
      fuel: {
        totalLitres: fFuel.reduce((s, f) => s + (Number(f.litres || f.fuelAmount) || 0), 0),
        transactions: fFuel.length,
        preview: fFuel.slice(0, 5),
      },
      vendors: {
        total: vendors.length,
        active: vendors.filter((v) => v.status === 'active').length,
        preview: vendors.slice(0, 5).map((v: any) => ({
          ...v,
          poCount: purchaseOrders.filter((p: any) => p.vendorId === v.id).length,
        })),
      },
      trucks: {
        total: vehicles.length,
        active: vehicles.filter((v: any) => v.status === 'active').length,
        preview: vehicles.slice(0, 5),
      },
      drivers: {
        total: drivers.length,
        active: drivers.filter((d: any) => d.status === 'active').length,
        preview: drivers.slice(0, 5),
      },
      materials: {
        total: materials.length,
        types: [...new Set(materials.map((m: any) => m.name).filter(Boolean))],
        preview: materials.slice(0, 5),
      },
      purchaseOrders: {
        total: purchaseOrders.length,
        open: purchaseOrders.filter((p: any) =>
          ['approved', 'pending', 'in_progress'].includes(p.status)
        ).length,
        fulfilled: purchaseOrders.filter((p: any) =>
          ['completed', 'delivered'].includes(p.status)
        ).length,
        preview: purchaseOrders.slice(0, 5),
      },
      quarryOps: {
        total: deliveries.filter((d: any) => d.weighInAt).length,
        active: deliveries.filter((d: any) => d.weighInAt && !d.weighOutAt).length,
        completed: deliveries.filter((d: any) => d.weighInAt && d.weighOutAt).length,
        totalTonnage: deliveries
          .filter((d: any) => d.weighInAt)
          .reduce((s: number, d: any) => s + (Number(d.weighInWeight) || 0), 0),
        preview: deliveries.filter((d: any) => d.weighInAt).slice(0, 5),
      },
      warehouse: {
        total: fDel.filter((d: any) => d.isWarehouseDelivery || String(d.deliveryOrigin || '').toLowerCase() === 'warehouse').length,
        active: fDel.filter((d: any) =>
          (d.isWarehouseDelivery || String(d.deliveryOrigin || '').toLowerCase() === 'warehouse') &&
          !['SITE_WEIGHED_OUT', 'COMPLETED', 'CANCELLED', 'completed', 'cancelled'].includes(d.status)
        ).length,
        completed: fDel.filter((d: any) =>
          (d.isWarehouseDelivery || String(d.deliveryOrigin || '').toLowerCase() === 'warehouse') &&
          ['SITE_WEIGHED_OUT', 'COMPLETED', 'completed', 'delivered'].includes(d.status)
        ).length,
        totalQuantity: fDel
          .filter((d: any) => d.isWarehouseDelivery || String(d.deliveryOrigin || '').toLowerCase() === 'warehouse')
          .reduce((s: number, d: any) => s + (Number(d.quantityDelivered) || Number(d.quantityOrdered) || 0), 0),
      },
      siteOps: {
        total: deliveries.filter((d: any) => d.siteWeighInAt || d.warehouseAcceptedAt).length,
        active: deliveries.filter((d: any) => (d.siteWeighInAt || d.warehouseAcceptedAt) && !d.siteWeighOutAt && !(d.isWarehouseDelivery && d.materialInspection?.mrfNumber)).length,
        completed: deliveries.filter((d: any) => (d.siteWeighInAt && d.siteWeighOutAt) || (d.isWarehouseDelivery && d.materialInspection?.mrfNumber)).length,
        totalNet: deliveries
          .filter((d: any) => d.siteWeighInAt && !d.isWarehouseDelivery)
          .reduce((s: number, d: any) => s + (Number(d.siteNetWeight || d.netWeight) || 0), 0),
        preview: deliveries.filter((d: any) => d.siteWeighInAt || d.warehouseAcceptedAt).slice(0, 5),
      },
      inspections: {
        total: fDel.filter((d: any) => d.materialInspection?.mrfNumber).length,
        failed: fDel.filter((d: any) => (d.materialInspection?.materialReceipts || []).some((line: any) => line.initialVisualInspection === 'Failed')).length,
        pending: fDel.filter((d: any) => (d.materialInspection?.materialReceipts || []).some((line: any) => (line.initialVisualInspection || 'Pending') === 'Pending')).length,
        preview: fDel.filter((d: any) => d.materialInspection?.mrfNumber).slice(0, 5),
      },
      storeActivity: {
        total: fDel.reduce((sum: number, d: any) => sum + (d.materialInspection?.materialReceipts?.length || 0), 0),
        passed: fDel.reduce((sum: number, d: any) => sum + (d.materialInspection?.materialReceipts || []).filter((line: any) => line.initialVisualInspection === 'Pass').length, 0),
        failed: fDel.reduce((sum: number, d: any) => sum + (d.materialInspection?.materialReceipts || []).filter((line: any) => line.initialVisualInspection === 'Failed').length, 0),
        preview: fDel.filter((d: any) => d.materialInspection?.materialReceipts?.length),
      },
      fuelByJob,
    };
  }, [deliveries, drivers, vehicles, vendors, materials, purchaseOrders, fuelRecords, filter]);

  const d: any = metrics[activeTab as keyof typeof metrics];
  const currentCat = CATEGORIES.find((c) => c.key === activeTab) || CATEGORIES[0];

  // ─── Direct export handlers (api functions handle web/native internally) ───

  const handleExportMaster = async () => {
    setExporting(true);
    try {
      await downloadReportExcel({ filter: filter !== 'all' ? filter : undefined });
    } catch (error: any) {
      Alert.alert('Export Failed', error?.message || 'Could not download the file.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadCSV = async () => {
    setCsvDownloading(true);
    try {
      const categoryMap: Record<string, string> = {
        purchaseOrders: 'purchase-orders',
        quarryOps: 'quarry-ops',
        siteOps: 'site-ops',
        warehouse: 'warehouse',
      };
      const catKey = categoryMap[activeTab] || activeTab;
      await downloadCategoryCSV(catKey, { filter: filter !== 'all' ? filter : undefined });
    } catch (error: any) {
      Alert.alert('Export Failed', error?.message || 'Could not download the file.');
    } finally {
      setCsvDownloading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const isLoading =
    deliveries.length === 0 &&
    drivers.length === 0 &&
    vehicles.length === 0 &&
    vendors.length === 0 &&
    materials.length === 0;

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f.key ? colors.primary : colors.surface,
                borderColor: filter === f.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filter === f.key ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.exportBtn,
          { backgroundColor: '#10B981', opacity: exporting ? 0.6 : 1 },
        ]}
        onPress={handleExportMaster}
        disabled={exporting}
        activeOpacity={0.8}
      >
        {exporting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
        )}
        <Text style={styles.exportBtnText}>
          {exporting ? 'Generating...' : 'Export Master Audit Excel'}
        </Text>
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabRow}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === cat.key ? cat.color : colors.surface,
                borderColor: cat.color,
              },
            ]}
            onPress={() => setActiveTab(cat.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={cat.icon as any}
              size={14}
              color={readableTextColor(activeTab === cat.key ? '#FFFFFF' : cat.color, activeTab === cat.key ? cat.color : colors.surface)}
            />
            <Text
              style={[
                styles.tabText,
                { color: readableTextColor(activeTab === cat.key ? '#FFFFFF' : cat.color, activeTab === cat.key ? cat.color : colors.surface) },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <SectionTitle title={`${currentCat.label}`} />
      {activeTab === 'storeActivity' ? <View style={{ gap: 8, marginBottom: 12 }}>{(d.preview || []).flatMap((job: any) => (job.materialInspection?.materialReceipts || []).map((line: any, index: number) => <View key={`${job.id}-${index}`} style={{ padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><Text style={{ color: colors.text, fontWeight: '800' }}>{job.jobId || job.id} · {job.poNumber || job.purchaseOrderId || 'No PO'}</Text><Text style={{ color: colors.textMuted }}>{line.materialName || job.materialName} · Qty: {line.receivedQuantity ?? '—'} {line.unit || ''}</Text><Text style={{ color: colors.textMuted }}>Inspector: {job.materialInspection?.inspectorName || '—'} · {new Date(job.materialInspection?.inspectedAt || job.updatedAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}</Text><Text style={{ color: line.initialVisualInspection === 'Failed' ? '#DC2626' : '#059669', fontWeight: '700' }}>{line.initialVisualInspection || 'Pending'}{line.failureReason || line.deficiency ? ` · ${line.failureReason || line.deficiency}` : ''}</Text></View>))}</View> : null}

      <TouchableOpacity
        style={[
          styles.csvBtn,
          {
            borderColor: currentCat.color,
            opacity: csvDownloading ? 0.5 : 1,
          },
        ]}
        onPress={handleDownloadCSV}
        disabled={csvDownloading}
        activeOpacity={0.7}
      >
        {csvDownloading ? (
          <ActivityIndicator color={readableTextColor(currentCat.color, colors.background)} size="small" />
        ) : (
          <Ionicons name="document-outline" size={16} color={readableTextColor(currentCat.color, colors.background)} />
        )}
        <Text style={[styles.csvBtnText, { color: readableTextColor(currentCat.color, colors.background) }]}>
          {csvDownloading ? 'Downloading...' : `Download ${currentCat.label} CSV`}
        </Text>
      </TouchableOpacity>

      
      <View style={{ height: 40 }} />
    </PageShell>
  );
}

// ─── Helper components (unchanged) ──────────────────────────────────

function renderCategoryCards(tab: string, d: any, colors: any, m: any) {
  switch (tab) {
    case 'deliveries':
      return (
        <>
          <MetricCard icon="cube-outline" label="Deliveries" value={d.total ?? 0} color="#2563EB" />
          <MetricCard icon="scale-outline" label="Tonnage" value={`${(d.totalTonnage ?? 0).toFixed(1)}T`} color="#2563EB" />
        </>
      );
    case 'fuel':
      return (
        <>
          <MetricCard icon="water-outline" label="Litres" value={`${(d.totalLitres ?? 0).toFixed(0)}L`} color="#F59E0B" />
          <MetricCard icon="receipt-outline" label="Transactions" value={d.transactions ?? 0} color="#F59E0B" />
        </>
      );
    case 'vendors':
      return (
        <>
          <MetricCard icon="business-outline" label="Vendors" value={d.total ?? 0} color="#8B5CF6" />
          <MetricCard icon="checkmark-outline" label="Active" value={d.active ?? 0} color="#10B981" />
        </>
      );
    case 'trucks':
      return (
        <>
          <MetricCard icon="car-outline" label="Trucks" value={d.total ?? 0} color="#EC4899" />
          <MetricCard icon="checkmark-outline" label="Active" value={d.active ?? 0} color="#10B981" />
        </>
      );
    case 'drivers':
      return (
        <>
          <MetricCard icon="people-outline" label="Drivers" value={d.total ?? 0} color="#10B981" />
          <MetricCard icon="checkmark-outline" label="Active" value={d.active ?? 0} color="#10B981" />
        </>
      );
    case 'materials':
      return (
        <>
          <MetricCard icon="layers-outline" label="Materials" value={d.total ?? 0} color="#6366F1" />
          <MetricCard icon="list-outline" label="Types" value={d.types?.length ?? 0} color="#6366F1" />
        </>
      );
    case 'purchaseOrders':
      return (
        <>
          <MetricCard icon="document-text-outline" label="Total POs" value={d.total ?? 0} color="#0EA5E9" />
        </>
      );
    case 'quarryOps':
      return (
        <>
          <MetricCard icon="checkmark-circle-outline" label="Dispatched" value={d.completed ?? 0} color="#10B981" />
        </>
      );
    case 'storeActivity':
      return (
        <>
          <MetricCard icon="archive-outline" label="Receipts" value={d.total ?? 0} color="#7C3AED" />
          <MetricCard icon="checkmark-circle-outline" label="Passed" value={d.passed ?? 0} color="#10B981" />
          <MetricCard icon="close-circle-outline" label="Failed" value={d.failed ?? 0} color="#DC2626" />
        </>
      );
    case 'siteOps':
      return (
        <>
          <MetricCard icon="business-outline" label="Arrivals" value={d.total ?? 0} color="#059669" />
        </>
      );
    case 'warehouse':
      return (
        <>
          <MetricCard icon="cube-outline" label="Shipments" value={d.total ?? 0} color="#7C3AED" />
        </>
      );
    case 'inspections':
      return (
        <>
          <MetricCard icon="clipboard-outline" label="MIFs" value={d.total ?? 0} color="#0F766E" />
          <MetricCard icon="close-circle-outline" label="Failed" value={d.failed ?? 0} color="#B91C1C" />
          <MetricCard icon="time-outline" label="Pending" value={d.pending ?? 0} color="#D97706" />
        </>
      );
    default:
      return null;
  }
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterScroll: { marginBottom: Spacing.xs},
  filterRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    borderRadius: Radius.md, marginBottom: Spacing.xs,
  },
  exportBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  tabScroll: { marginBottom: Spacing.xs},
  tabRow: { gap: Spacing.xs },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, fontWeight: '800' },
  csvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5, marginBottom: Spacing.xs,
  },
  csvBtnText: { fontSize: 13, fontWeight: '800' },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm, marginBottom: Spacing.xs,
  },
  metricCard: {
    width: '30%',
    flexGrow: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontSize: 20, fontWeight: '900', marginTop: Spacing.xs},
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
