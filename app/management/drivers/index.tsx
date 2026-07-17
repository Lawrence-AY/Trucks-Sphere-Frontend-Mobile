/**
 * Driver List Screen - Full CRUD with search, filter, and pagination
 *
 * Features:
 *   - Search by name, phone, national ID
 *   - Filter by status
 *   - Create new driver
 *   - Tap to view driver details
 *   - Shows vendor name and national ID
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { driverRepository } from '../../../services/repositories/DriverRepository';
import { fetchVendors } from '../../../services/api';


export default function DriverListScreen() {
  const colors = useTheme();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [vendorNameMap, setVendorNameMap] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      driverRepository.invalidateCache();
      loadDrivers();
    }, []),
  );

  useEffect(() => {
    return driverRepository.onChange(() => {
      driverRepository.getAll().then(setDrivers).catch(() => {});
    });
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [search, drivers]);

  async function loadDrivers() {
    try {
      // Fetch drivers and vendors in parallel, then resolve vendor names
      const [driverData, vendorData] = await Promise.all([
        driverRepository.getAll(),
        fetchVendors(),
      ]);

      // Build vendor name lookup: vendorId → vendor name
      const nameMap: Record<string, string> = {};
      vendorData.forEach((v: any) => {
        nameMap[v.id] = v.name || v.companyName || 'Unknown';
      });
      setVendorNameMap(nameMap);

      setDrivers(driverData);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    driverRepository.invalidateCache();
    await loadDrivers();
    setRefreshing(false);
  }

  function filterDrivers() {
    let result = [...drivers];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) => {
          const name = d.name || d.fullName || '';
          return (
            name.toLowerCase().includes(q) ||
            d.driverId?.toLowerCase().includes(q) ||
            d.phone?.includes(q) ||
            d.nationalId?.toLowerCase().includes(q) ||
            d.vendorName?.toLowerCase().includes(q)
          );
        }
      );
    }
    setFiltered(result);
  }

  function getDriverName(item: any): string {
    return item.name || item.fullName || 'Unknown Driver';
  }

  function renderDriver({ item }: { item: any }) {
    const name = getDriverName(item);
    return (
      <TouchableOpacity
        style={[styles.driverCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/management/drivers/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.driverHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.vendorRow}>
              <Ionicons name="business-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.vendorLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {item.vendorName || vendorNameMap[item.vendorId] || '—'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.driverMeta, { borderTopColor: colors.border }]}>
          <View style={styles.metaItem}>
            <Ionicons name="call-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>{item.phone || '-'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="card-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
              {item.nationalId || 'No ID'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSkeleton lines={6} variant="card" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              Drivers
            </Text>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {drivers.length} driver{drivers.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search drivers..."
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
        renderItem={renderDriver}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={search ? 'No drivers found' : 'No drivers yet'}
            subtitle={
              search
                ? 'Try a different search term'
                : 'Create your first driver to get started'
            }
            actionLabel={search ? undefined : 'Add Driver'}
            onAction={search ? undefined : () => router.push('/management/drivers/create' as any)}
          />
        }
      />

      {/* FAB - Add Driver */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/management/drivers/create' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  list: {
    padding: Spacing.md,
    paddingTop: 0,
    paddingBottom: Spacing['4xl'],
  },
  driverCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  vendorLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  driverMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
});
