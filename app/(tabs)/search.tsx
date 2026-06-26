import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

const SEARCH_CATEGORIES = [
  { key: 'all', label: 'All', icon: 'grid-outline' as const },
  { key: 'drivers', label: 'Drivers', icon: 'people-outline' as const },
  { key: 'vendors', label: 'Vendors', icon: 'briefcase-outline' as const },
  { key: 'vehicles', label: 'Vehicles', icon: 'car-outline' as const },
  { key: 'orders', label: 'Orders', icon: 'document-text-outline' as const },
];

// Mock search results (will be replaced with API calls in production)
const MOCK_RESULTS: Record<string, any[]> = {
  drivers: [],
  vendors: [],
  vehicles: [],
  orders: [],
};

export default function SearchScreen() {
  const colors = useTheme();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const isTyping = query.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Input */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search drivers, vendors, trucks..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Pills */}
      <FlatList
        horizontal
        data={SEARCH_CATEGORIES}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryChip,
              { borderColor: colors.border },
              activeCategory === item.key && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
            onPress={() => setActiveCategory(item.key)}
          >
            <Ionicons
              name={item.icon}
              size={16}
              color={activeCategory === item.key ? '#FFF' : colors.textSecondary}
            />
            <Text style={[
              styles.categoryText,
              { color: colors.textSecondary },
              activeCategory === item.key && { color: '#FFF' },
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Results or Empty State */}
      {isTyping ? (
        <View style={styles.resultsArea}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {/* Placeholder — real results come from API */}
            Results for "{query}"
          </Text>
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Search across all entities{'\n'}Results will appear from the backend
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <View style={[styles.searchIconLarge, { backgroundColor: colors.accent + '10' }]}>
            <Ionicons name="search" size={40} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Global Search</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Find drivers, vendors, trucks, or orders{'\n'}across the entire fleet
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 46, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15 },
  categoriesRow: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1,
  },
  categoryText: { fontSize: 13, fontWeight: '600' },
  resultsArea: { flex: 1, padding: Spacing.lg },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.md },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing['3xl'],
  },
  searchIconLarge: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
