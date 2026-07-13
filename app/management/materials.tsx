import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchMaterials } from '../../services/api';
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

export default function ManagementMaterialsScreen() {
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
    try {
      const materialData = await fetchMaterials();
      setMaterials(materialData || []);
    } catch (error) {
      console.error('Materials load error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(materials.map((m: any) => m.category || 'Uncategorized'));
    return ['all', ...Array.from(cats).sort()];
  }, [materials]);

  const catOptions = useMemo(() => {
    return categories.map((cat) => ({ key: cat, label: cat === 'all' ? 'All Categories' : cat }));
  }, [categories]);

  const catFiltered = catSearch.trim()
    ? catOptions.filter((c) => c.label.toLowerCase().includes(catSearch.toLowerCase()))
    : catOptions;

  const selectedCategory = catOptions.find((c) => c.key === categoryFilter);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return materials.filter((item) => {
      const matchesSearch = !query || [item.name, item.category]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesCategory = categoryFilter === 'all' || (item.category || 'Uncategorized') === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [materials, search, categoryFilter]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search material, category..." />

      {/* Category Dropdown Filter */}
      <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.xs, marginBottom: Spacing.xs }}>
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

      <SectionTitle title={`${filtered.length} materials`} />

      {loading ? (
        <DataCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>Loading materials...</Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}` as any)}>
            <View style={styles.cardHead}>
              <View style={styles.cardCopy}>
                <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.subtle, { color: colors.textMuted }]}>
                  {item.category || 'Material'} · {item.unit || 'tons'}
                </Text>
              </View>
            </View>
            <DetailRow icon="cube-outline" value={`Unit: ${item.unit || 'tons'}`} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials found" subtitle="Try another search term or refresh the data." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontWeight: '700' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  cardCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '900' },
  subtle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: 6 },
  dropdownBtnText: { flex: 1, fontSize: 14 },
  dropdownMenu: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: Spacing.md },
  catSearchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, gap: 6 },
  catSearchInput: { flex: 1, fontSize: 13, paddingVertical: 2 },
});
