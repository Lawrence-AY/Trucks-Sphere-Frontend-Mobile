import { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
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
import { fetchMaterials, fetchPurchaseOrders } from '../../services/api';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function MaterialsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [materials, setMaterials] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [matSearch, setMatSearch] = useState('');
  const [catSearch, setCatSearch] = useState('');

  const vendorId = user?.role === 'vendor' ? user.vendorId : null;

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [materialData, orderData] = await Promise.all([
        fetchMaterials(),
        fetchPurchaseOrders(),
      ]);
      setMaterials(materialData || []);
      setOrders(vendorId ? (orderData || []).filter((item: any) => item.vendorId === vendorId) : orderData || []);
    } catch (error) {
      console.error('Materials load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const materialOptions = useMemo(() => {
    return [{ key: 'all', label: 'All Materials' }, ...materials.map((m: any) => ({ key: m.id, label: m.name || m.id }))];
  }, [materials]);

  const categories = useMemo(() => {
    const cats = new Set(materials.map((m: any) => m.category || 'Uncategorized'));
    return ['all', ...Array.from(cats).sort()];
  }, [materials]);

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({ key: cat, label: cat === 'all' ? 'All Categories' : cat }));
  }, [categories]);

  const matFiltered = matSearch.trim()
    ? materialOptions.filter(m => (m.label || '').toLowerCase().includes(matSearch.toLowerCase()))
    : materialOptions;

  const catFiltered = catSearch.trim()
    ? categoryOptions.filter(c => c.label.toLowerCase().includes(catSearch.toLowerCase()))
    : categoryOptions;

  const selectedMaterial = materialOptions.find(m => m.key === materialFilter);
  const selectedCategory = categoryOptions.find(c => c.key === categoryFilter);

  const materialCards = useMemo(() => {
    const query = search.toLowerCase();
    return materials
      .map((material) => {
        const materialOrders = orders.filter((order) => order.materialId === material.id || order.materialName === material.name);
        const ordered = materialOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
        const vendors = new Set(materialOrders.map((order) => order.vendorId || order.vendorName).filter(Boolean));
        return {
          ...material,
          purchaseOrderCount: materialOrders.length,
          ordered,
          vendorCount: vendors.size,
        };
      })
      .filter((item) => {
        const hasRecords = item.purchaseOrderCount > 0 || !vendorId;
        const matchesSearch = !query || [item.name, item.category]
          .some((value) => String(value || '').toLowerCase().includes(query));
        const matchesMaterial = materialFilter === 'all' || item.id === materialFilter;
        const matchesCategory = categoryFilter === 'all' || (item.category || 'Uncategorized') === categoryFilter;
        return hasRecords && matchesSearch && matchesMaterial && matchesCategory;
      })
      .sort((a, b) => b.ordered - a.ordered);
  }, [materials, materialFilter, categoryFilter, orders, search, vendorId]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <CommandHeader
        eyebrow="Delivery materials"
        title="Materials"
        subtitle={user?.role === 'vendor' ? 'Materials linked to your purchase orders' : 'Purchase orders grouped by material'}
      />

      <View style={styles.metricRow}>
        <MetricTile icon="cube" label="Materials" value={materialCards.length} tone={colors.primary} />
        <MetricTile icon="document-text" label="Purchase orders" value={orders.length} tone={colors.accent} />
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search material, category..." />

      {/* Category Dropdown Filter */}
      <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.sm }}>
        <TouchableOpacity
          style={[styles.dropdownBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setCatSearch(''); setMaterialDropdownOpen(false); }}
        >
          <Ionicons name="folder-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.dropdownBtnText, { color: selectedCategory?.key !== 'all' ? colors.text : colors.textMuted }]} numberOfLines={1}>
            {selectedCategory?.key !== 'all' ? selectedCategory?.label : 'Filter by category...'}
          </Text>
          {categoryFilter !== 'all' ? (
            <TouchableOpacity onPress={() => setCategoryFilter('all')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <Ionicons name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          )}
        </TouchableOpacity>
        {categoryDropdownOpen && (
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.innerSearchRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="search" size={14} color={colors.textMuted} />
              <TextInput style={[styles.innerSearchInput, { color: colors.text }]} placeholder="Search categories..." placeholderTextColor={colors.textMuted} value={catSearch} onChangeText={setCatSearch} autoFocus />
            </View>
            <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
              {catFiltered.map((c: any) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.dropdownItem, c.key === categoryFilter && { backgroundColor: colors.primary + '15' }]}
                  onPress={() => { setCategoryFilter(c.key); setCategoryDropdownOpen(false); }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{c.label}</Text>
                  {c.key === categoryFilter && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Material Dropdown Filter */}
      <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm }}>
        <TouchableOpacity
          style={[styles.dropdownBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => { setMaterialDropdownOpen(!materialDropdownOpen); setMatSearch(''); setCategoryDropdownOpen(false); }}
        >
          <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.dropdownBtnText, { color: selectedMaterial?.key !== 'all' ? colors.text : colors.textMuted }]} numberOfLines={1}>
            {selectedMaterial?.key !== 'all' ? selectedMaterial?.label : 'Filter by material...'}
          </Text>
          {materialFilter !== 'all' ? (
            <TouchableOpacity onPress={() => setMaterialFilter('all')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <Ionicons name={materialDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          )}
        </TouchableOpacity>
        {materialDropdownOpen && (
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.innerSearchRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="search" size={14} color={colors.textMuted} />
              <TextInput style={[styles.innerSearchInput, { color: colors.text }]} placeholder="Search materials..." placeholderTextColor={colors.textMuted} value={matSearch} onChangeText={setMatSearch} autoFocus />
            </View>
            <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
              {matFiltered.map((m: any) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.dropdownItem, m.key === materialFilter && { backgroundColor: colors.primary + '15' }]}
                  onPress={() => { setMaterialFilter(m.key); setMaterialDropdownOpen(false); }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{m.label}</Text>
                  {m.key === materialFilter && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <SectionTitle title={`${materialCards.length} material cards`} />

      {loading ? (
        <DataCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading materials...</Text>
        </DataCard>
      ) : materialCards.length ? (
        materialCards.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}`)}>
            <View style={styles.cardHead}>
              <View style={styles.cardCopy}>
                <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.subtle, { color: colors.textMuted }]}>
                  {item.purchaseOrderCount} POs
                </Text>
              </View>
            </View>
            <DetailRow icon="download-outline" value={`Ordered ${Math.round(item.ordered)} ${item.unit || 'units'}`} />
            <DetailRow icon="business-outline" value={`${item.vendorCount} linked vendors`} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials found" subtitle="Try another search term or refresh the data." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: 6 },
  dropdownBtnText: { flex: 1, fontSize: 14 },
  dropdownMenu: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: Spacing.md },
  innerSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
  innerSearchInput: { flex: 1, fontSize: 13, paddingVertical: 2 },
});