import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchPurchaseOrders, fetchMaterials } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function OrdersScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [matDropdownOpen, setMatDropdownOpen] = useState(false);
  const [matSearch, setMatSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [data, matData] = await Promise.all([
        fetchPurchaseOrders(),
        fetchMaterials(),
      ]);
      const filtered = user?.role === 'vendor' ? (data || []).filter((item: any) => item.vendorId === (user.vendorId || 'v1')) : data || [];
      setOrders(filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setMaterials(matData || []);
    } catch (error) {
      console.error('Orders load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role, user?.vendorId]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter((item) => {
      const matchesSearch = !query || [item.poNumber, item.vendorName, item.materialName]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesFilter = true;
      const matchesMaterial = !materialFilter || item.materialId === materialFilter;
      return matchesSearch && matchesFilter && matchesMaterial;
    });
  }, [materialFilter, orders, search]);

  const materialOptions = useMemo(() => {
    return [{ id: '', name: 'All Materials' }, ...materials.map((m: any) => ({ id: m.id, name: m.name || m.id }))];
  }, [materials]);

  const matFiltered = matSearch.trim()
    ? materialOptions.filter(m => (m.name || '').toLowerCase().includes(matSearch.toLowerCase()))
    : materialOptions;

  const selectedMaterial = materialOptions.find(m => m.id === materialFilter);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader
        eyebrow="Procurement execution"
        title="Purchase orders"
        subtitle={`${orders.length} orders`}
      />

      <SearchField value={search} onChangeText={setSearch} placeholder="Search PO, vendor, material..." />

      {/* Material Dropdown Filter */}
      <View style={{ marginBottom: Spacing.sm }}>
        <TouchableOpacity
          style={[styles.dropdownBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => { setMatDropdownOpen(!matDropdownOpen); setMatSearch(''); }}
        >
          <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.dropdownBtnText, { color: selectedMaterial?.id ? colors.text : colors.textMuted }]} numberOfLines={1}>
            {selectedMaterial?.id ? selectedMaterial.name : 'Filter by material...'}
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
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.matSearchRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="search" size={14} color={colors.textMuted} />
              <TextInput style={[styles.matSearchInput, { color: colors.text }]} placeholder="Search materials..." placeholderTextColor={colors.textMuted} value={matSearch} onChangeText={setMatSearch} autoFocus />
            </View>
            <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
              {matFiltered.map((m: any) => (
                <TouchableOpacity key={m.id} style={[styles.dropdownItem, m.id === materialFilter && { backgroundColor: colors.accent + '15' }]} onPress={() => { setMaterialFilter(m.id || ''); setMatDropdownOpen(false); }}>
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{m.name}</Text>
                  {m.id === materialFilter && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.fabRow}>
        <SectionTitle title={`${filtered.length} purchase orders`} />
        <TouchableOpacity style={styles.fabAdd} onPress={() => router.push('/screens/purchase-order?new=true' as any)}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <DataCard>
          <Text style={[styles.summarySub, { color: colors.textMuted }]}>Loading purchase orders...</Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const ordered = Number(item.quantity || 0);
          return (
            <DataCard key={item.id} onPress={() => router.push(`/screens/purchase-order?id=${item.id}`)}>
              <View style={styles.cardHead}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.poNumber, { color: colors.text }]}>{item.poNumber}</Text>
                  <Text style={[styles.summarySub, { color: colors.textMuted }]}>{item.vendorName}</Text>
                </View>
              </View>
              <DetailRow icon="cube-outline" value={`${item.materialName} · ${Math.round(ordered)} ${item.unit || 'units'}`} />
              <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{formatEAT(item.createdAt)}</Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState icon="document-text-outline" title="No purchase orders found" subtitle="Adjust the search or filter to see more records." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  fabRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fabAdd: { width: 36, height: 36, borderRadius: Radius.md, borderWidth: 1, borderColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  summarySub: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  poNumber: { fontSize: 17, fontWeight: '900' },
  timestamp: { fontSize: 11, fontWeight: '700' },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: 6 },
  dropdownBtnText: { flex: 1, fontSize: 14 },
  dropdownMenu: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: Spacing.md },
  matSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
  matSearchInput: { flex: 1, fontSize: 13, paddingVertical: 2 },
});