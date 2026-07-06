import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchMaterials } from '../../services/api';
import { DataCard, DetailRow, EmptyState, PageShell, SearchField, SectionTitle } from '../../components/EnterpriseUI';

export default function OperatorQuarryMaterialsScreen() {
  const colors = useTheme();
  const [materials, setMaterials] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');

  const loadData = async () => {
    setRefreshing(true);
    try { setMaterials((await fetchMaterials()) || []); } catch {
    } finally { setRefreshing(false); setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const categories = useMemo(() => {
    const cats = new Set(materials.map((m: any) => m.category || 'Uncategorized'));
    return ['all', ...Array.from(cats).sort()];
  }, [materials]);

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({ key: cat, label: cat === 'all' ? 'All Categories' : cat }));
  }, [categories]);

  const catFiltered = catSearch.trim()
    ? categoryOptions.filter(c => c.label.toLowerCase().includes(catSearch.toLowerCase()))
    : categoryOptions;

  const selectedCategory = categoryOptions.find(c => c.key === categoryFilter);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return materials.filter((m) => {
      const matchesSearch = !q || (m.name || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || (m.category || 'Uncategorized') === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [materials, search, categoryFilter]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search..." />

      {/* Category Dropdown Filter */}
      <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.sm }}>
        <TouchableOpacity
          style={[styles.dropdownBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => { setDropdownOpen(!dropdownOpen); setCatSearch(''); }}
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
            <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          )}
        </TouchableOpacity>
        {dropdownOpen && (
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.catSearchRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="search" size={14} color={colors.textMuted} />
              <TextInput style={[styles.catSearchInput, { color: colors.text }]} placeholder="Search categories..." placeholderTextColor={colors.textMuted} value={catSearch} onChangeText={setCatSearch} autoFocus />
            </View>
            <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
              {catFiltered.map((c: any) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.dropdownItem, c.key === categoryFilter && { backgroundColor: colors.primary + '15' }]}
                  onPress={() => { setCategoryFilter(c.key); setDropdownOpen(false); }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{c.label}</Text>
                  {c.key === categoryFilter && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <SectionTitle title={`${filtered.length} items`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.name}</Text>
            <DetailRow icon="folder-outline" value={item.category || 'Uncategorized'} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials" />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: 6 },
  dropdownBtnText: { flex: 1, fontSize: 14 },
  dropdownMenu: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: Spacing.md },
  catSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
  catSearchInput: { flex: 1, fontSize: 13, paddingVertical: 2 },
});