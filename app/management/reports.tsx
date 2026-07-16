/**
 * Consolidated Reports & Exports Dashboard - 9 tabs
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders, fetchDrivers, fetchVehicles, fetchVendors, fetchMaterials, fetchPurchaseOrders, fetchFuelRecords, downloadReportExcel, downloadCategoryCSV } from '../../services/api';
import { DataCard, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { formatEAT } from '../../utils/helpers';

const FILTERS = [
  { key: 'all', label: 'All Time' }, { key: 'day', label: 'Today' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' },
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
  { key: 'siteOps', label: 'Site Ops', icon: 'business-outline', color: '#059669' },
];

function withinTimeframe(dateStr: string, flt: string): boolean {
  if (!dateStr || flt === 'all') return true;
  const d = new Date(dateStr); if (isNaN(d.getTime())) return false;
  const now = new Date(); const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (flt) {
    case 'day': return d >= todayStart;
    case 'week': { const ws = new Date(todayStart); ws.setDate(ws.getDate() - ws.getDay() + 1); return d >= ws; }
    case 'month': return d >= new Date(now.getFullYear(), now.getMonth(), 1);
    default: return true;
  }
}

export default function ReportsScreen() {
  const colors = useTheme();
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('deliveries');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);

  const loadAllData = useCallback(async () => { setLoading(true); try { const [d, dr, vh, vn, mt, po, fr] = await Promise.all([fetchDeliveryOrders(), fetchDrivers(), fetchVehicles(), fetchVendors(), fetchMaterials(), fetchPurchaseOrders(), fetchFuelRecords()]); setDeliveries(d || []); setDrivers(dr || []); setVehicles(vh || []); setVendors(vn || []); setMaterials(mt || []); setPurchaseOrders(po || []); setFuelRecords(fr || []); } catch {} finally { setLoading(false); } }, []);
  useEffect(() => { loadAllData(); }, [loadAllData]);

  const metrics = useMemo(() => {
    const fDel = deliveries.filter((d) => withinTimeframe(d.createdAt || d.updatedAt, filter));
    const fFuel = fuelRecords.filter((r) => withinTimeframe(r.createdAt || r.timestamp || r.dispensedAt, filter));
    // Build fuel lookup map keyed by jobId for per-delivery fuel display
    const fuelByJob: Record<string, { totalLitres: number; attendantName: string }> = {};
    fFuel.forEach((f: any) => {
      const jobId = f.jobId;
      if (jobId) {
        if (!fuelByJob[jobId]) fuelByJob[jobId] = { totalLitres: 0, attendantName: '' };
        fuelByJob[jobId].totalLitres += Number(f.litres || f.fuelAmount || 0);
        fuelByJob[jobId].attendantName = fuelByJob[jobId].attendantName || f.attendantName || f.dispensedBy || '';
      }
    });
    return {
      deliveries: { total: fDel.length, totalTonnage: fDel.reduce((s, d) => s + (Number(d.netWeight) || Number(d.quantityDelivered) || 0), 0), completed: fDel.filter((d) => ['completed', 'delivered'].includes(d.status)).length, inTransit: fDel.filter((d) => ['loaded', 'dispatched', 'in_transit', 'en_route'].includes(d.status)).length, preview: fDel.slice(0, 5) },
      fuel: { totalLitres: fFuel.reduce((s, f) => s + (Number(f.litres || f.fuelAmount) || 0), 0), transactions: fFuel.length, preview: fFuel.slice(0, 5) },
      vendors: { total: vendors.length, active: vendors.filter((v) => v.status === 'active').length, preview: vendors.slice(0, 5).map((v: any) => ({ ...v, poCount: purchaseOrders.filter((p: any) => p.vendorId === v.id).length })) },
      trucks: { total: vehicles.length, active: vehicles.filter((v: any) => v.status === 'active').length, preview: vehicles.slice(0, 5) },
      drivers: { total: drivers.length, active: drivers.filter((d: any) => d.status === 'active').length, preview: drivers.slice(0, 5) },
      materials: { total: materials.length, types: [...new Set(materials.map((m: any) => m.name).filter(Boolean))], preview: materials.slice(0, 5) },
      purchaseOrders: { total: purchaseOrders.length, open: purchaseOrders.filter((p: any) => ['approved', 'pending', 'in_progress'].includes(p.status)).length, fulfilled: purchaseOrders.filter((p: any) => ['completed', 'delivered'].includes(p.status)).length, preview: purchaseOrders.slice(0, 5) },
      quarryOps: { total: deliveries.filter((d: any) => d.weighInAt).length, active: deliveries.filter((d: any) => d.weighInAt && !d.weighOutAt).length, completed: deliveries.filter((d: any) => d.weighInAt && d.weighOutAt).length, totalTonnage: deliveries.filter((d: any) => d.weighInAt).reduce((s: number, d: any) => s + (Number(d.weighInWeight) || 0), 0), preview: deliveries.filter((d: any) => d.weighInAt).slice(0, 5) },
      siteOps: { total: deliveries.filter((d: any) => d.siteWeighInAt).length, active: deliveries.filter((d: any) => d.siteWeighInAt && !d.siteWeighOutAt).length, completed: deliveries.filter((d: any) => d.siteWeighInAt && d.siteWeighOutAt).length, totalNet: deliveries.filter((d: any) => d.siteWeighInAt).reduce((s: number, d: any) => s + (Number(d.siteNetWeight || d.netWeight) || 0), 0), preview: deliveries.filter((d: any) => d.siteWeighInAt).slice(0, 5) },
      fuelByJob,
    };
  }, [deliveries, drivers, vehicles, vendors, materials, purchaseOrders, fuelRecords, filter]);

  const d = metrics[activeTab as keyof typeof metrics];
  const currentCat = CATEGORIES.find((c) => c.key === activeTab) || CATEGORIES[0];

  const handleExportMaster = async () => { setExporting(true); try { await downloadReportExcel({ filter: filter !== 'all' ? filter : undefined }); } catch {} finally { setExporting(false); } };
  // Map frontend camelCase tab keys to backend dash-separated category names
  const backendCategoryMap: Record<string, string> = {
    purchaseOrders: 'purchase-orders',
    quarryOps: 'quarry-ops',
    siteOps: 'site-ops',
  };
  const handleDownloadCSV = async () => { setCsvDownloading(true); try { await downloadCategoryCSV(backendCategoryMap[activeTab] || activeTab, { filter: filter !== 'all' ? filter : undefined }); } catch {} finally { setCsvDownloading(false); } };

  return (
    <PageShell>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (<TouchableOpacity key={f.key} style={[styles.filterChip, { backgroundColor: filter === f.key ? colors.primary : colors.surface, borderColor: filter === f.key ? colors.primary : colors.border }]} onPress={() => setFilter(f.key)} activeOpacity={0.7}><Text style={[styles.filterChipText, { color: filter === f.key ? '#FFFFFF' : colors.textSecondary }]}>{f.label}</Text></TouchableOpacity>))}
      </ScrollView>
      <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#10B981', opacity: exporting ? 0.6 : 1 }]} onPress={handleExportMaster} disabled={exporting} activeOpacity={0.8}>
        {exporting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="download-outline" size={20} color="#FFFFFF" />}
        <Text style={styles.exportBtnText}>{exporting ? 'Generating...' : 'Export Master Audit Excel'}</Text>
      </TouchableOpacity>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {CATEGORIES.map((cat) => (<TouchableOpacity key={cat.key} style={[styles.tab, { backgroundColor: activeTab === cat.key ? cat.color : colors.surface, borderColor: cat.color }]} onPress={() => setActiveTab(cat.key)} activeOpacity={0.7}><Ionicons name={cat.icon as any} size={14} color={activeTab === cat.key ? '#FFFFFF' : cat.color} /><Text style={[styles.tabText, { color: activeTab === cat.key ? '#FFFFFF' : cat.color }]}>{cat.label}</Text></TouchableOpacity>))}
      </ScrollView>
      <SectionTitle title={`${currentCat.label}`} />
      <TouchableOpacity style={[styles.csvBtn, { borderColor: currentCat.color, opacity: csvDownloading ? 0.5 : 1 }]} onPress={handleDownloadCSV} disabled={csvDownloading} activeOpacity={0.7}>
        {csvDownloading ? <ActivityIndicator color={currentCat.color} size="small" /> : <Ionicons name="document-outline" size={16} color={currentCat.color} />}
        <Text style={[styles.csvBtnText, { color: currentCat.color }]}>{csvDownloading ? 'Downloading...' : `Download ${currentCat.label} CSV`}</Text>
      </TouchableOpacity>
      {loading ? (<DataCard><View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}><ActivityIndicator color={colors.primary} /><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading live data...</Text></View></DataCard>) : d ? (<><View style={styles.metricsGrid}>{renderCategoryCards(activeTab, d, colors, metrics)}</View>{d && 'preview' in (d as any) && (d as any).preview && (d as any).preview.length > 0 && (<><SectionTitle title="Recent Records" /><DataCard>{renderPreviewTable(activeTab, (d as any).preview, colors, metrics)}</DataCard></>)}</>) : (<DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>No data available.</Text></DataCard>)}
      <View style={{ height: 40 }} />
    </PageShell>
  );
}

function renderCategoryCards(tab: string, d: any, colors: any, m: any) {
  switch (tab) {
    case 'deliveries': return (<><MetricCard icon="cube-outline" label="Deliveries" value={d.total ?? 0} color="#2563EB" /><MetricCard icon="scale-outline" label="Tonnage" value={`${(d.totalTonnage ?? 0).toFixed(1)}T`} color="#2563EB" /><MetricCard icon="checkmark-circle-outline" label="Completed" value={d.completed ?? 0} color="#10B981" /><MetricCard icon="pulse-outline" label="In Transit" value={d.inTransit ?? 0} color="#F59E0B" /></>);
    case 'fuel': return (<><MetricCard icon="water-outline" label="Litres" value={`${(d.totalLitres ?? 0).toFixed(0)}L`} color="#F59E0B" /><MetricCard icon="receipt-outline" label="Transactions" value={d.transactions ?? 0} color="#F59E0B" /></>);
    case 'vendors': return (<><MetricCard icon="business-outline" label="Vendors" value={d.total ?? 0} color="#8B5CF6" /><MetricCard icon="checkmark-outline" label="Active" value={d.active ?? 0} color="#10B981" /></>);
    case 'trucks': return (<><MetricCard icon="car-outline" label="Trucks" value={d.total ?? 0} color="#EC4899" /><MetricCard icon="checkmark-outline" label="Active" value={d.active ?? 0} color="#10B981" /></>);
    case 'drivers': return (<><MetricCard icon="people-outline" label="Drivers" value={d.total ?? 0} color="#10B981" /><MetricCard icon="checkmark-outline" label="Active" value={d.active ?? 0} color="#10B981" /></>);
    case 'materials': return (<><MetricCard icon="layers-outline" label="Materials" value={d.total ?? 0} color="#6366F1" /><MetricCard icon="list-outline" label="Types" value={d.types?.length ?? 0} color="#6366F1" /></>);
    case 'purchaseOrders': return (<><MetricCard icon="document-text-outline" label="Total POs" value={d.total ?? 0} color="#0EA5E9" /><MetricCard icon="time-outline" label="Open" value={d.open ?? 0} color="#F59E0B" /><MetricCard icon="checkmark-circle-outline" label="Fulfilled" value={d.fulfilled ?? 0} color="#10B981" /></>);
    case 'quarryOps': return (<><MetricCard icon="hammer-outline" label="Quarry Visits" value={d.total ?? 0} color="#D97706" /><MetricCard icon="time-outline" label="Active (In)" value={d.active ?? 0} color="#F59E0B" /><MetricCard icon="checkmark-circle-outline" label="Dispatched" value={d.completed ?? 0} color="#10B981" /><MetricCard icon="scale-outline" label="Gross W.In" value={`${(d.totalTonnage ?? 0).toFixed(1)}T`} color="#D97706" /></>);
    case 'siteOps': return (<><MetricCard icon="business-outline" label="Site Arrivals" value={d.total ?? 0} color="#059669" /><MetricCard icon="time-outline" label="Active (In)" value={d.active ?? 0} color="#F59E0B" /><MetricCard icon="checkmark-circle-outline" label="Completed" value={d.completed ?? 0} color="#10B981" /><MetricCard icon="scale-outline" label="Net Weight" value={`${(d.totalNet ?? 0).toFixed(1)}T`} color="#059669" /></>);
    default: return null;
  }
}

function renderPreviewTable(tab: string, items: any[], colors: any, m: any) {
  if (!items || items.length === 0) return <Text style={{ fontSize: 13, color: colors.textMuted }}>No records yet.</Text>;
  switch (tab) {
    case 'deliveries': return items.map((d, i) => {
      const jobFuel = (m as any).fuelByJob?.[d.jobId];
      return (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{d.jobId || d.id}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{d.vendorName || '—'} · {d.plateNumber || '—'} · {d.materialName || '—'}</Text><View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: 2, flexWrap: 'wrap' }}><Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>{(d.netWeight || d.quantityDelivered) ? `${Number(d.netWeight || d.quantityDelivered).toFixed(1)}T` : '—'}</Text><Text style={{ fontSize: 11, color: colors.textTertiary }}>{d.status || '—'}</Text>{jobFuel && jobFuel.totalLitres > 0 ? <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700' }}>⛽ {jobFuel.totalLitres.toFixed(1)}L</Text> : null}</View></View>);
    });
    case 'fuel': return items.map((f, i) => (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{f.driverName || '—'} · {f.plateNumber || '—'}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{Number(f.litres || f.fuelAmount || 0).toFixed(1)}L · {f.attendantName || f.dispensedBy || '—'}</Text></View>));
    case 'vendors': return items.map((v, i) => (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{v.name || v.vendorName || v.id}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{v.status || 'active'} · {v.poCount || 0} POs</Text></View>));
    case 'trucks': return items.map((v, i) => (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{v.plateNumber || v.plate || v.id}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{v.make || ''} {v.model || ''} · {v.status || 'active'}</Text></View>));
    case 'drivers': return items.map((d, i) => (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{d.name || d.fullName || d.id}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>DL: {d.licenseNumber || '—'} · {d.status || 'active'}</Text></View>));
    case 'materials': return items.map((m, i) => (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{m.name || m.id}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{m.category || '—'} · {m.unit || 'Tonnes'}</Text></View>));
    case 'purchaseOrders': return items.map((p, i) => (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{p.poNumber || p.id}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{p.vendorName || '—'} · {p.materialName || '—'} · {p.quantity || 0}T</Text><Text style={{ fontSize: 11, color: colors.textTertiary }}>{p.status || '—'}</Text></View>));
    case 'quarryOps': return items.map((d, i) => {
      const jobFuel = (m as any).fuelByJob?.[d.jobId];
      return (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{d.jobId || d.id}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{d.driverName || '—'} · {d.plateNumber || '—'} · {d.materialName || '—'}</Text><View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: 2, flexWrap: 'wrap' }}><Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700' }}>In: {d.weighInWeight ? `${Number(d.weighInWeight).toFixed(1)}T` : '—'}</Text><Text style={{ fontSize: 11, color: '#059669', fontWeight: '700' }}>Out: {d.weighOutWeight ? `${Number(d.weighOutWeight).toFixed(1)}T` : '—'}</Text><Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>Net: {d.netWeight ? `${Number(d.netWeight).toFixed(1)}T` : '—'}</Text>{jobFuel && jobFuel.totalLitres > 0 ? <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700' }}>⛽ {jobFuel.totalLitres.toFixed(1)}L</Text> : null}</View></View>);
    });
    case 'siteOps': return items.map((d, i) => {
      const jobFuel = (m as any).fuelByJob?.[d.jobId];
      return (<View key={i} style={{ marginBottom: i < items.length - 1 ? Spacing.sm : 0, paddingBottom: i < items.length - 1 ? Spacing.sm : 0, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{d.jobId || d.id}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{d.driverName || '—'} · {d.plateNumber || '—'} · {d.materialName || '—'}</Text><View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: 2, flexWrap: 'wrap' }}><Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700' }}>In: {d.siteWeighInWeight ? `${Number(d.siteWeighInWeight).toFixed(1)}T` : '—'}</Text><Text style={{ fontSize: 11, color: '#059669', fontWeight: '700' }}>Out: {d.siteWeighOutWeight ? `${Number(d.siteWeighOutWeight).toFixed(1)}T` : '—'}</Text><Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>Net: {d.siteNetWeight || d.netWeight ? `${Number(d.siteNetWeight || d.netWeight).toFixed(1)}T` : '—'}</Text>{jobFuel && jobFuel.totalLitres > 0 ? <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700' }}>⛽ {jobFuel.totalLitres.toFixed(1)}L</Text> : null}</View></View>);
    });
    default: return null;
  }
}

function MetricCard({ icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors = useTheme();
  return (<View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.metricIcon, { backgroundColor: `${color}15` }]}><Ionicons name={icon} size={16} color={color} /></View><Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text></View>);
}

const styles = StyleSheet.create({
  filterScroll: { marginBottom: Spacing.sm }, filterRow: { gap: Spacing.sm, paddingVertical: Spacing.xs }, filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 }, filterChipText: { fontSize: 12, fontWeight: '700' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50, borderRadius: Radius.md, marginBottom: Spacing.md }, exportBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  tabScroll: { marginBottom: Spacing.md }, tabRow: { gap: Spacing.xs }, tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, borderWidth: 1 }, tabText: { fontSize: 12, fontWeight: '800' },
  csvBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: Radius.md, borderWidth: 1.5, marginBottom: Spacing.sm }, csvBtnText: { fontSize: 13, fontWeight: '800' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm }, metricCard: { width: '30%', flexGrow: 1, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, alignItems: 'center', gap: 4 }, metricIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, metricValue: { fontSize: 20, fontWeight: '900', marginTop: 2 }, metricLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
});