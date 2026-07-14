/**
 * Consolidated Reports & Exports Dashboard
 *
 * Tabbed interface: Deliveries | Fuel | Vendors | Trucks | Drivers | Materials | POs
 * Fetches live data from the existing system APIs used by all other screens.
 * No mock data — same data pipeline as operator dashboards.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import {
  fetchDeliveryOrders,
  fetchDrivers,
  fetchVehicles,
  fetchVendors,
  fetchMaterials,
  fetchPurchaseOrders,
  fetchFuelRecords,
  downloadReportExcel,
  downloadCategoryCSV,
} from '../../services/api';
import { DataCard, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { formatEAT } from '../../utils/helpers';

/* ─── Constants ─── */

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
  { key: 'purchase-orders', label: 'POs', icon: 'document-text-outline', color: '#0EA5E9' },
];

/* ─── Timeframe helper ─── */

function withinTimeframe(dateStr: string, flt: string): boolean {
  if (!dateStr || flt === 'all') return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (flt) {
    case 'day': return d >= todayStart;
    case 'week': {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      return d >= weekStart;
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= monthStart;
    }
    default: return true;
  }
}

/* ─── Component ─── */

export default function ReportsScreen() {
  const colors = useTheme();
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('deliveries');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [csvDownloading, setCsvDownloading] = useState(false);

  // ─── Live data from existing proven APIs ───
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, dr, vh, vn, mt, po, fr] = await Promise.all([
        fetchDeliveryOrders(),
        fetchDrivers(),
        fetchVehicles(),
        fetchVendors(),
        fetchMaterials(),
        fetchPurchaseOrders(),
        fetchFuelRecords(),
      ]);
      setDeliveries(d || []);
      setDrivers(dr || []);
      setVehicles(vh || []);
      setVendors(vn || []);
      setMaterials(mt || []);
      setPurchaseOrders(po || []);
      setFuelRecords(fr || []);
    } catch {
      // Data stays as empty arrays
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ─── Compute metrics from live data (client-side, always accurate) ───
  const metrics = useMemo(() => {
    // Filtered deliveries
    const filteredDeliveries = deliveries.filter((d) =>
      withinTimeframe(d.createdAt || d.updatedAt, filter),
    );
    const filteredFuel = fuelRecords.filter((r) =>
      withinTimeframe(r.createdAt || r.timestamp, filter),
    );

    return {
      deliveries: {
        total: filteredDeliveries.length,
        totalTonnage: filteredDeliveries.reduce((s, d) => s + (Number(d.netWeight) || Number(d.quantityDelivered) || 0), 0),
        completed: filteredDeliveries.filter((d) => ['completed', 'delivered'].includes(d.status)).length,
        inTransit: filteredDeliveries.filter((d) => ['loaded', 'dispatched', 'in_transit', 'en_route'].includes(d.status)).length,
        preview: filteredDeliveries.slice(0, 5),
      },
      fuel: {
        totalLitres: filteredFuel.reduce((s, f) => s + (Number(f.litres) || 0), 0),
        transactions: filteredFuel.length,
        preview: filteredFuel.slice(0, 5),
      },
      vendors: {
        total: vendors.length,
        active: vendors.filter((v) => v.status === 'active').length,
        preview: vendors.slice(0, 5).map((v) => ({
          ...v,
          poCount: purchaseOrders.filter((p) => p.vendorId === v.id).length,
        })),
      },
      trucks: {
        total: vehicles.length,
        active: vehicles.filter((v) => v.status === 'active').length,
        preview: vehicles.slice(0, 5),
      },
      drivers: {
        total: drivers.length,
        active: drivers.filter((d) => d.status === 'active').length,
        preview: drivers.slice(0, 5),
      },
      materials: {
        total: materials.length,
        types: [...new Set(materials.map((m) => m.name).filter(Boolean))],
        preview: materials.slice(0, 5),
      },
      purchaseOrders: {
        total: purchaseOrders.length,
        open: purchaseOrders.filter((p) => ['approved', 'pending', 'in_progress'].includes(p.status)).length,
        fulfilled: purchaseOrders.filter((p) => ['completed', 'delivered'].includes(p.status)).length,
        preview: purchaseOrders.slice(0, 5),
      },
    };
  }, [deliveries, drivers, vehicles, vendors, materials, purchaseOrders, fuelRecords, filter]);

  const d = metrics[activeTab as keyof typeof metrics];

  const handleExportMaster = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (filter && filter !== 'all') params.filter = filter;
      await downloadReportExcel(params);
    } catch (error: any) {
      Alert.alert('Export Failed', error?.message || 'Could not download.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadCSV = async () => {
    setCsvDownloading(true);
    try {
      const params: any = {};
      if (filter && filter !== 'all') params.filter = filter;
      await downloadCategoryCSV(activeTab, params);
    } catch (error: any) {
      Alert.alert('Download Failed', error?.message || 'Could not download.');
    } finally {
      setCsvDownloading(false);
    }
  };

  const currentCat = CATEGORIES.find((c) => c.key === activeTab) || CATEGORIES[0];

  return (
    <PageShell>
      {/* ─── Filter Bar ─── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, { backgroundColor: filter === f.key ? colors.primary : colors.surface, borderColor: filter === f.key ? colors.primary : colors.border }]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, { color: filter === f.key ? '#FFFFFF' : colors.textSecondary }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ─── Global Export Button ─── */}
      <TouchableOpacity
        style={[styles.exportBtn, { backgroundColor: '#10B981', opacity: exporting ? 0.6 : 1 }]}
        onPress={handleExportMaster}
        disabled={exporting}
        activeOpacity={0.8}
      >
        {exporting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="download-outline" size={20} color="#FFFFFF" />}
        <Text style={styles.exportBtnText}>{exporting ? 'Generating...' : 'Export Master Audit Excel'}</Text>
      </TouchableOpacity>

      {/* ─── Tab Bar ─── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.tab, { backgroundColor: activeTab === cat.key ? cat.color : colors.surface, borderColor: cat.color }]}
            onPress={() => setActiveTab(cat.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={cat.icon as any} size={14} color={activeTab === cat.key ? '#FFFFFF' : cat.color} />
            <Text style={[styles.tabText, { color: activeTab === cat.key ? '#FFFFFF' : cat.color }]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ─── Tab Content ─── */}
      <SectionTitle title={`${currentCat.label}`} />

      <TouchableOpacity
        style={[styles.csvBtn, { borderColor: currentCat.color, opacity: csvDownloading ? 0.5 : 1 }]}
        onPress={handleDownloadCSV}
        disabled={csvDownloading}
        activeOpacity={0.7}
      >
        {csvDownloading ? <ActivityIndicator color={currentCat.color} size="small" /> : <Ionicons name="document-outline" size={16} color={currentCat.color} />}
        <Text style={[styles.csvBtnText, { color: currentCat.color }]}>{csvDownloading ? 'Downloading...' : `Download ${currentCat.label} CSV`}</Text>
      </TouchableOpacity>

      {loading ? (
        <DataCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ fontSize: 14, color: colors.textMuted }}>Loading live data...</Text>
          </View>
        </DataCard>
      ) : d ? (
        <>
          <View style={styles.metricsGrid}>{renderCategoryCards(activeTab, d, colors, metrics)}</View>
          {d.preview && d.preview.length > 0 && (
            <>
              <SectionTitle title="Recent Records" />
              <DataCard>{renderPreviewTable(activeTab, d.preview, colors, metrics)}</DataCard>
            </>
          )}
        </>
      ) : (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>No data available.</Text>
        </DataCard>
      )}

      <View style={{ height: 40 }} />
    </PageShell>
  );
}

/* ─── Card Renderers (uses live data from system) ─── */

function renderCategoryCards(tab: string, d: any, colors: any, m: any) {
  switch (tab) {
    case 'deliveries':
      return (
        <>
          <MetricCard icon="cube-outline" label="Deliveries" value={d.total ?? 0} color="#2563EB" />
          <MetricCard icon="scale-outline" label="Tonnage" value={`${(d.totalTonnage ?? 0).toFixed(1)}T`} color="#2563EB" />
          <MetricCard icon="checkmark-circle-outline" label="Completed" value={d.completed ?? 0} color="#10B981" />
          <MetricCard icon="pulse-outline" label="In Transit" value={d.inTransit ?? 0} color="#F59E0B" />
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
    case 'purchase-orders':
      return (
        <>
          <MetricCard icon="document-text-outline" label="Total POs" value={d.total ?? 0} color="#0EA5E9" />
          <MetricCard icon="time-outline" label="Open" value={d.open ?? 0} color="#F59E0B" />
          <MetricCard icon="checkmark-circle-outline" label="Fulfilled" value={d.fulfilled ?? 0} color="#10B981" />
        </>
      );
    default:
      return null;
  }
}

function renderPreviewTable(tab: string, items: any[], colors: any, m: any) {
  if (!items || items.length === 0) return <Text style={{ fontSize: 13, color: colors.textMuted }}>No records yet.</Text>;

  switch (tab) {
    case 'deliveries':
      return items.map((d, i) => (
        <View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{d.jobId || d.id}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{d.vendorName || '—'} · {d.plateNumber || '—'} · {d.materialName || '—'}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: 2 }}>
            <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>{(d.netWeight || d.quantityDelivered) ? `${Number(d.netWeight || d.quantityDelivered).toFixed(1)}T` : '—'}</Text>
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>{d.status || '—'}</Text>
          </View>
        </View>
      ));
    case 'fuel':
      return items.map((f, i) => (
        <View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{f.driverName || '—'} · {f.plateNumber || '—'}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{Number(f.litres || 0).toFixed(1)}L · {f.attendantName || f.dispensedBy || '—'}</Text>
        </View>
      ));
    case 'vendors':
      return items.map((v, i) => (
        <View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{v.name || v.vendorName || v.id}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{v.status || 'active'} · {v.poCount || 0} POs</Text>
        </View>
      ));
    case 'trucks':
      return items.map((v, i) => (
        <View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{v.plateNumber || v.plate || v.id}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{v.make || ''} {v.model || ''} · {v.status || 'active'}</Text>
        </View>
      ));
    case 'drivers':
      return items.map((d, i) => (
        <View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{d.name || d.fullName || d.id}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>DL: {d.licenseNumber || '—'} · {d.status || 'active'}</Text>
        </View>
      ));
    case 'materials':
      return items.map((m, i) => (
        <View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{m.name || m.id}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{m.category || '—'} · {m.unit || 'Tonnes'}</Text>
        </View>
      ));
    case 'purchase-orders':
      return items.map((p, i) => (
        <View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{p.poNumber || p.id}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{p.vendorName || '—'} · {p.materialName || '—'} · {p.quantity || 0}T</Text>
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>{p.status || '—'}</Text>
        </View>
      ));
    default:
      return null;
  }
}

function MetricCard({ icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors = useTheme();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterScroll: { marginBottom: Spacing.sm },
  filterRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50, borderRadius: Radius.md, marginBottom: Spacing.md },
  exportBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  tabScroll: { marginBottom: Spacing.md },
  tabRow: { gap: Spacing.xs },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, borderWidth: 1 },
  tabText: { fontSize: 12, fontWeight: '800' },
  csvBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: Radius.md, borderWidth: 1.5, marginBottom: Spacing.sm },
  csvBtnText: { fontSize: 13, fontWeight: '800' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  metricCard: { width: '30%', flexGrow: 1, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, alignItems: 'center', gap: 4 },
  metricIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  metricLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
});