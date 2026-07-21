/**
 * Vendor List Screen - Full CRUD with search, filter, and pagination
 *
 * Features:
 *   - Search by name, contact, KRA PIN
 *   - Filter by status
 *   - Create new vendor
 *   - Tap to view vendor details with tabs
 *   - Pull to refresh
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { Vendor } from '../../../store/types';
import { fetchDrivers, fetchVehicles, fetchDeliveryOrders } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { hasManagementPermission } from '../../../utils/access';

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'warning', label: 'Inactive' },
  suspended: { variant: 'danger', label: 'Suspended' },
};

export default function VendorListScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const canWriteVendors = hasManagementPermission(user?.role, 'vendors.write');
  const insets = useSafeAreaInsets();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filtered, setFiltered] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [vendorStats, setVendorStats] = useState<Record<string, { drivers: number; vehicles: number; jobs: number }>>({});

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    filterVendors();
  }, [search, vendors]);

  async function loadVendors() {
    try {
      // Fetch all parallel: vendors, drivers, vehicles, jobs
      const [vendorData, drivers, vehicles, jobs] = await Promise.all([
        vendorRepository.getAll(),
        fetchDrivers(),
        fetchVehicles(),
        fetchDeliveryOrders(),
      ]);

      setVendors(vendorData);

      // Compute per-vendor stats
      const stats: Record<string, { drivers: number; vehicles: number; jobs: number }> = {};
      vendorData.forEach((v) => {
        const vid = v.id;
        stats[vid] = {
          drivers: drivers.filter((d: any) => d.vendorId === vid).length,
          vehicles: vehicles.filter((t: any) => t.vendorId === vid).length,
          jobs: jobs.filter((j: any) => j.vendorId === vid).length,
        };
      });
      setVendorStats(stats);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    vendorRepository.invalidateCache();
    await loadVendors();
    setRefreshing(false);
  }

  function filterVendors() {
    let result = [...vendors];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.companyName?.toLowerCase().includes(q) ||
          (v as any).name?.toLowerCase().includes(q) ||
          v.contactPerson?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q) ||
          (v as any).address?.toLowerCase().includes(q) ||
          v.vendorId?.toLowerCase().includes(q) ||
          v.kraPin?.toLowerCase().includes(q) ||
          v.phone?.includes(q)
      );
    }
    setFiltered(result);
  }

  function getStatusBadge(status?: string) {
    const config = STATUS_BADGE[status || ''] || { variant: 'default' as const, label: status || 'Unknown' };
    return <Badge label={config.label} variant={config.variant as any} size="sm" dot />;
  }

  function renderVendor({ item }: { item: Vendor }) {
    // Backend uses 'name' as the primary field; fall back to 'companyName' if available
    const displayName = item.companyName || (item as any).name || 'Unknown Vendor';

    return (
      <TouchableOpacity
        style={[styles.vendorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/management/vendors/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.vendorHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {displayName?.charAt(0)?.toUpperCase() || 'V'}
            </Text>
          </View>
          <View style={styles.vendorInfo}>
            <Text style={[styles.vendorName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {item.email ? (
              <Text style={[styles.vendorId, { color: colors.textMuted }]} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.vendorMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
              {item.contactPerson || 'No contact'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="call-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>{item.phone || '-'}</Text>
          </View>
        </View>

        <View style={styles.vendorStats}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {vendorStats[item.id]?.drivers ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Drivers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {vendorStats[item.id]?.vehicles ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Trucks</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {vendorStats[item.id]?.jobs ?? 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Trips</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Vendors</Text>
        </View>
        <LoadingSkeleton lines={6} variant="card" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {canWriteVendors && (
            <Button
              title="Add Vendor"
              onPress={() => router.push('/management/vendors/create' as any)}
              icon="add-circle-outline"
              size="sm"
            />
          )}
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search vendors..."
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
        renderItem={renderVendor}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="business-outline"
            title={search ? 'No vendors found' : 'No vendors yet'}
            subtitle={
              search
                ? 'Try a different search term'
                : 'Create your first vendor to get started'
            }
            actionLabel={!search && canWriteVendors ? 'Add Vendor' : undefined}
            onAction={!search && canWriteVendors ? () => router.push('/management/vendors/create' as any) : undefined}
          />
        }
      />
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
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
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
  vendorCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '700',
  },
  vendorId: {
    fontSize: 12,
    marginTop: 1,
  },
  vendorMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  vendorStats: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 1,
  },
});
