/**
 * Materials List Screen - Full CRUD with categories and dynamic properties
 *
 * Features:
 *   - List all materials grouped by category
 *   - Search by name
 *   - Filter by category
 *   - Create new material with dynamic properties
 *   - Tap to view/edit material details
 *   - Pull to refresh
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { materialRepository } from '../../../services/repositories/MaterialRepository';
import { Material, MaterialCategory } from '../../../store/types';

const CATEGORIES: MaterialCategory[] = ['Aggregates', 'Steel', 'Cement', 'Liquid', 'Blocks', 'Other'];

const CATEGORY_ICONS: Record<string, string> = {
  Aggregates: 'layers-outline',
  Steel: 'barbell-outline',
  Cement: 'cube-outline',
  Liquid: 'water-outline',
  Blocks: 'grid-outline',
  Other: 'ellipsis-horizontal-outline',
};

const CATEGORY_COLORS: Record<string, string> = {
  Aggregates: '#F59E0B',
  Steel: '#6B7280',
  Cement: '#3B82F6',
  Liquid: '#06B6D4',
  Blocks: '#8B5CF6',
  Other: '#10B981',
};

export default function MaterialsListScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  async function loadMaterials() {
    try {
      const data = await materialRepository.getAll();
      setMaterials(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    materialRepository.invalidateCache();
    await loadMaterials();
    setRefreshing(false);
  }

  function getFilteredMaterials(): Material[] {
    let result = [...materials];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      result = result.filter((m) => m.category === categoryFilter);
    }
    return result;
  }

  function getGroupedMaterials(): { title: string; data: Material[] }[] {
    const filtered = getFilteredMaterials();
    const grouped: Record<string, Material[]> = {};
    CATEGORIES.forEach((cat) => {
      const items = filtered.filter((m) => m.category === cat);
      if (items.length > 0) grouped[cat] = items;
    });
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }

  function renderMaterial({ item }: { item: Material }) {
    const catColor = CATEGORY_COLORS[item.category || 'Other'] || colors.primary;
    return (
      <TouchableOpacity
        style={[styles.materialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/management/materials/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.materialHeader}>
          <View style={[styles.materialIcon, { backgroundColor: catColor + '15' }]}>
            <Ionicons
              name={(CATEGORY_ICONS[item.category || 'Other'] || 'cube-outline') as any}
              size={20}
              color={catColor}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.materialName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.materialCategory, { color: colors.textMuted }]}>
              {item.category} • {item.defaultUnit || item.measurementType || 'units'}
            </Text>
          </View>
          <Badge
            label={item.status || 'active'}
            variant={item.status === 'active' ? 'success' : 'default'}
            size="sm"
            dot
          />
        </View>
        {item.properties && item.properties.length > 0 && (
          <View style={styles.propertiesRow}>
            {item.properties.slice(0, 3).map((prop, i) => (
              <View key={i} style={[styles.propertyChip, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.propertyChipText, { color: colors.textMuted }]}>
                  {prop.label}: {prop.options?.join(', ') || prop.type}
                </Text>
              </View>
            ))}
            {item.properties.length > 3 && (
              <Text style={[styles.moreProps, { color: colors.textMuted }]}>
                +{item.properties.length - 3} more
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  function renderSectionHeader({ section }: { section: { title: string; data: Material[] } }) {
    const catColor = CATEGORY_COLORS[section.title] || colors.primary;
    return (
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: catColor }]} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
        <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
          {section.data.length}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Materials</Text>
        </View>
        <LoadingSkeleton lines={5} variant="card" />
      </View>
    );
  }

  const grouped = getGroupedMaterials();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Materials</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Materials</Text>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {materials.length} material{materials.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Button
            title="Add Material"
            onPress={() => router.push('/management/materials/create' as any)}
            icon="add-circle-outline"
            size="sm"
          />
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search materials..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        <FlatList
          horizontal
          data={['all', ...CATEGORIES]}
          keyExtractor={(s) => s}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: categoryFilter === cat || (cat === 'all' && !categoryFilter)
                    ? CATEGORY_COLORS[cat] || colors.primary
                    : colors.surface,
                  borderColor: categoryFilter === cat || (cat === 'all' && !categoryFilter)
                    ? CATEGORY_COLORS[cat] || colors.primary
                    : colors.border,
                },
              ]}
              onPress={() => setCategoryFilter(cat === 'all' ? null : cat)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: categoryFilter === cat || (cat === 'all' && !categoryFilter)
                      ? '#FFFFFF'
                      : colors.textMuted,
                  },
                ]}
              >
                {cat === 'all' ? 'All' : cat}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {grouped.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title={search ? 'No materials found' : 'No materials yet'}
          subtitle={search ? 'Try a different search term' : 'Create your first material'}
          actionLabel={search ? undefined : 'Add Material'}
          onAction={search ? undefined : () => router.push('/management/materials/create' as any)}
        />
      ) : (
        <SectionList
          sections={grouped}
          keyExtractor={(item) => item.id}
          renderItem={renderMaterial}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 4,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  count: {
    fontSize: 13,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    padding: Spacing.md,
    paddingTop: 0,
    paddingBottom: Spacing['4xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 13,
  },
  materialCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  materialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialName: {
    fontSize: 15,
    fontWeight: '700',
  },
  materialCategory: {
    fontSize: 12,
    marginTop: 1,
  },
  propertiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  propertyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  propertyChipText: {
    fontSize: 11,
  },
  moreProps: {
    fontSize: 11,
    alignSelf: 'center',
  },
});
