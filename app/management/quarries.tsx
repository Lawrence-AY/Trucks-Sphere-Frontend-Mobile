/**
 * Quarry Management Screen - List and manage quarries
 *
 * Features:
 *   - List all quarries with location and status
 *   - Search and filter
 *   - Create new quarry
 *   - View quarry details
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { formatEAT } from '../../utils/helpers';

interface Quarry {
  id: string;
  name: string;
  location: string;
  status: string;
  contactPerson: string;
  phone: string;
  materialTypes: string[];
  capacity: number;
  createdAt: string;
}

export default function QuarriesScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [quarries, setQuarries] = useState<Quarry[]>([]);
  const [filtered, setFiltered] = useState<Quarry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterData();
  }, [search, quarries]);

  async function loadData() {
    try {
      // Mock data - replace with repository call
      setQuarries([]);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function filterData() {
    let result = [...quarries];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.location?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Quarries</Text>
        </View>
        <LoadingSkeleton lines={5} variant="card" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Quarries</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {quarries.length} quarry{quarries.length !== 1 ? 'ies' : ''}
            </Text>
          </View>
          <Button
            title="Add Quarry"
            onPress={() => {}}
            icon="add-circle-outline"
            size="sm"
          />
        </View>

        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search quarries..."
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
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={() => null}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="map-outline"
            title="No quarries yet"
            subtitle="Quarries will appear here once configured"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: 24, fontWeight: '800' },
  count: { fontSize: 13, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  searchInput: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing['4xl'] },
});
