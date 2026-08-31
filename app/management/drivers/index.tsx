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
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { driverRepository } from '../../../services/repositories/DriverRepository';
import api, { fetchVendors } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { hasManagementPermission } from '../../../utils/access';
import { ManagementSearchHeader } from '../../../components/ManagementSearchHeader';


export default function DriverListScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const canWriteDrivers = hasManagementPermission(user?.role, 'drivers.write');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingOdoo, setSyncingOdoo] = useState(false);
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

  async function syncOdooDrivers() {
    setSyncingOdoo(true);
    try {
      let job = (await api.post('/api/drivers/sync/odoo')).data;
      const deadline = Date.now() + 60_000;

      while (job?.status === 'running' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        job = (await api.get('/api/drivers/sync/odoo')).data;
      }

      if (job?.status === 'completed') {
        driverRepository.invalidateCache();
        await loadDrivers();
        const result = job.result || {};
        Alert.alert(
          'Odoo drivers synchronized',
          `${result.imported || 0} added · ${result.updatedFromOdoo || 0} updated`,
        );
      } else if (job?.status === 'failed') {
        Alert.alert('Odoo sync failed', `Error code: ${job?.result?.code || 'ODOO_DRIVER_SYNC_FAILED'}`);
      } else {
        Alert.alert('Odoo sync is still running', 'Pull down to refresh the driver list in a moment.');
      }
    } catch {
      Alert.alert('Odoo sync failed', 'Unable to synchronize Odoo drivers. Please try again.');
    } finally {
      setSyncingOdoo(false);
    }
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
      <ManagementSearchHeader title="Drivers" search={search} onChangeSearch={setSearch} placeholder="Search drivers..." />
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
            actionLabel={!search && canWriteDrivers ? 'Add Driver' : undefined}
            onAction={!search && canWriteDrivers ? () => router.push('/management/drivers/create' as any) : undefined}
          />
        }
      />

      {/* FAB - Add Driver */}
      {canWriteDrivers && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/management/drivers/create' as any)}
          activeOpacity={0.85}
          accessibilityLabel="Add driver"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
  },
  count: {
    fontSize: 13,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm, marginBottom: Spacing.xs,
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
    borderRadius: 5,
    borderWidth: 1,
    padding: Spacing.md, marginBottom: Spacing.xs,
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
    gap: 4, marginTop: Spacing.xs,
  },
  vendorLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  driverMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    paddingTop: Spacing.md, marginTop: Spacing.xs,
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
