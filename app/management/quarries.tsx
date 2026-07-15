/**
 * Quarry Management Screen - List and manage quarries
 *
 * Features:
 *   - List all quarries with location and status
 *   - Search and filter
 *   - Create new quarry
 *   - View quarry details
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { fetchQuarries, fetchSites, fetchDeliveryOrders } from '../../services/api';
import { DetailRow } from '../../components/EnterpriseUI';
import { formatEAT } from '../../utils/helpers';

export default function QuarriesScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [quarries, setQuarries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await fetchQuarries();
      setQuarries(data || []);
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

  const filtered = useMemo(() => {
    if (!search.trim()) return quarries;
    const q = search.toLowerCase();
    return quarries.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.location?.address || item.location || '').toLowerCase().includes(q)
    );
  }, [quarries, search]);

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
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.count, { color: colors.textMuted }]}>
            {quarries.length} quarrie{quarries.length !== 1 ? 's' : ''}
          </Text>
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
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="business-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name || 'Unnamed Quarry'}</Text>
                <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                  {item.location?.address || item.location || 'No address'}
                </Text>
              </View>
              <Badge label={item.status || 'active'} variant={item.status === 'active' ? 'success' : 'default'} size="sm" />
            </View>
            {item.contact ? (
              <DetailRow icon="person-outline" value={`Contact: ${item.contact}`} />
            ) : null}
            {item.phone ? (
              <DetailRow icon="call-outline" value={item.phone} />
            ) : null}
            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
              Created: {item.createdAt ? formatEAT(item.createdAt) : '—'}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="map-outline"
            title="No quarries found"
            subtitle={search ? 'Try a different search term' : 'Quarries will appear here once configured'}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: 24, fontWeight: '800' },
  count: { fontSize: 13, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  searchInput: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing['4xl'] },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  cardIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  timestamp: { fontSize: 12, marginTop: Spacing.sm },
});
