import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchDeliveryOrders, fetchMaterials } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
 
  DataCard,
  DetailRow,
  EmptyState,
  FilterRail,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

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
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('');
  const [matDropdownOpen, setMatDropdownOpen] = useState(false);
  const [matSearch, setMatSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [data, matData] = await Promise.all([
        fetchDeliveryOrders(),
        fetchMaterials(),
      ]);
      setDeliveries(data || []);
      setMaterials(matData || []);
    } catch (error) {
      console.error('Active deliveries load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
      const matchesSearch = !query || [
        item.jobId, item.poNumber, item.driverName, item.plateNumber, item.vendorName, item.materialName,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      if (!matchesSearch) return false;

      // Time period filter
      if (filter !== 'all') {
        const itemDate = new Date(item.updatedAt || item.createdAt);
        if (itemDate < periodStart) return false;
      }

      // Material filter
      const matchesMaterial = !materialFilter || item.materialId === materialFilter;
      return matchesMaterial;
    });
  }, [deliveries, filter, search, materialFilter]);

  const matFiltered = matSearch.trim()
    ? materials.filter(m => (m.name || '').toLowerCase().includes(matSearch.toLowerCase()))
    : materials;

  const selectedMaterial = materials.find(m => m.id === materialFilter);

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
    await Share.share({ message: formatCsv(deliveryHeaders, rows), title: 'Delivery_Orders' });
  };

  const handleExportDeliveryPDF = async () => {
    const rows = buildDeliveryRows(filtered);
    const headerCells = deliveryHeaders.map(h => `<th style="padding:8px 10px;background:#1B2A4A;color:#fff;font-weight:700;text-align:left;border:1px solid #ddd;font-size:11px;">${h}</th>`).join('');
    const bodyRows = rows.map((row, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      const cells = row.map(cell => `<td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;">${cell || '—'}</td>`).join('');
      return `<tr style="background:${bg};">${cells}</tr>`;
    }).join('');
    const html = `<html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:16px;">
      <h1>Trucks Sphere — Delivery Orders</h1>
      <table style="width:100%;border-collapse:collapse;">${headerCells}${bodyRows}</table>
    </body></html>`;
    await Share.share({ message: html, title: 'Delivery_Orders' });
  };

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
       <SearchField value={search} onChangeText={setSearch} placeholder="Search job, driver, plate, vendor, material..." />

      {/* Period Filter */}
      <FilterRail options={FILTERS} value={filter} onChange={setFilter} />

      {/* Material Filter */}
      <View style={{ marginBottom: Spacing.sm, marginTop: Spacing.sm }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: 6, borderColor: colors.border, backgroundColor: colors.surface }}
          onPress={() => { setMatDropdownOpen(!matDropdownOpen); setMatSearch(''); }}
        >
          <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
          <Text style={{ flex: 1, fontSize: 13, color: selectedMaterial ? colors.text : colors.textMuted }} numberOfLines={1}>
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
          <View style={{ borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden', borderColor: colors.border, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, gap: 6, borderBottomColor: colors.border }}>
              <Ionicons name="search" size={14} color={colors.textMuted} />
              <TextInput style={{ flex: 1, fontSize: 13, paddingVertical: 2, color: colors.text }} placeholder="Search materials..." placeholderTextColor={colors.textMuted} value={matSearch} onChangeText={setMatSearch} autoFocus />
            </View>
            <ScrollView style={{ maxHeight: 150 }}>
              {matFiltered.map((m: any) => (
                <TouchableOpacity key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: Spacing.md }} onPress={() => { setMaterialFilter(m.id); setMatDropdownOpen(false); }}>
                  <Text style={{ color: colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>{m.name || m.id}</Text>
                  {m.id === materialFilter && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

    

      <SectionTitle title={`${filtered.length} deliveries`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading movement board...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/job-details?id=${item.jobId}` as any)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.poNumber || item.jobId}</Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>{item.vendorName || item.jobId}</Text>
                </View>
              </View>
              <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'No truck'}`} />
              <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`} />
              <DetailRow icon="navigate-outline" value={`${item.quarryName || 'Origin'} → ${item.siteName || 'Destination'}`} />
              {item.netWeight != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: `${colors.success}15`, marginTop: Spacing.sm }}>
                  <Ionicons name="scale-outline" size={12} color={colors.success} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.success }}>Net: {item.netWeight.toFixed(1)}T</Text>
                </View>
              )}
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="file-tray-outline" title="No deliveries found" subtitle="Try a broader search or another filter." />
      )}
    </PageShell>
  );
}