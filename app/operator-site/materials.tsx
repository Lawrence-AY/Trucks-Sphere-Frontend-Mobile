import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchMaterials } from '../../services/api';
import { CommandHeader, DataCard, DetailRow, EmptyState, PageShell, SearchField, SectionTitle } from '../../components/EnterpriseUI';

export default function OperatorSiteMaterialsScreen() {
  const colors = useTheme();
  const [materials, setMaterials] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      setMaterials((await fetchMaterials()) || []);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set(materials.map((m) => m.category || 'Uncategorized'));
    return ['All', ...Array.from(cats).sort()];
  }, [materials]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return materials.filter(
      (m) => {
        const matchesSearch = !q || (m.name || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q);
        const matchesCategory = selectedCategory === 'All' || (m.category || 'Uncategorized') === selectedCategory;
        return matchesSearch && matchesCategory;
      }
    );
  }, [materials, search, selectedCategory]);

  return (
    <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search material..." />

      {/* Category Dropdown */}
      <View style={{ marginBottom: Spacing.md, position: 'relative', zIndex: 10 }}>
        <TouchableOpacity
          style={[styles.dropdownTrigger, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setDropdownVisible(true)}
        >
          <Ionicons name="funnel-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.dropdownTriggerText, { color: colors.text }]}>
            Category: {selectedCategory}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
          <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
            <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 300 }}>
                {categories.map((cat) => {
                  const isActive = cat === selectedCategory;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.dropdownItem,
                        isActive && { backgroundColor: colors.inputBg },
                      ]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setDropdownVisible(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: isActive ? colors.primary : colors.text }]}>
                        {cat}
                      </Text>
                      {isActive && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>

      <SectionTitle title={`${filtered.length} materials`} />
      {loading ? (
        <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
      ) : filtered.length ? (
        filtered.map((item) => (
          <DataCard key={item.id} onPress={() => router.push(`/screens/material-details?id=${item.id}` as any)}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.name}</Text>
            <DetailRow icon="folder-outline" value={item.category || 'Uncategorized'} />
          </DataCard>
        ))
      ) : (
        <EmptyState icon="cube-outline" title="No materials" subtitle="No materials found." />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  dropdownTriggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownMenu: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    maxHeight: 320,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.sm,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
});