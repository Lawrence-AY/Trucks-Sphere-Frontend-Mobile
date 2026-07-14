/**
 * Drivers List Screen - Full CRUD with vendor filtering
 *
 * Features:
 *   - List all drivers with status indicators
 *   - Filter by vendor
 *   - Search by name, phone, license
 *   - Create new driver
 *   - Tap to view/edit driver details
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { driverRepository } from '../../../services/repositories/DriverRepository';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { Driver, Vendor } from '../../../store/types';

export default function DriversListScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [d, v] = await Promise.all([
        driverRepository.getAll(),
        vendorRepository.getAll(),
      ]);
      setDrivers(d);
      setVendors(v);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    driverRepository.invalidateCache();
    vendorRepository.invalidateCache();
    await loadData();
    setRefreshing(false);
  }

  function getFilteredDrivers(): Driver[] {
    let result = [...drivers];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.fullName?.toLowerCase().includes(q) ||
          d.phone?.includes(q) ||
          d.licenseNumber?.toLowerCase().includes(q) ||
          d.nationalId?.includes(q)
      );
    }
    if (vendorFilter) {
      result = result.filter((d) => d.vendorId === vendorFilter);
    }
    return result;
  }

  function getVendorName(vendorId?: string): string {
    if (!vendorId) return 'Unknown';
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.companyName || 'Unknown';
  }

  function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'default' {
    switch (status) {
      case 'active': return 'success';
      case 'on_trip': return 'warning';
      case 'inactive': return 'danger';
      default: return 'default';
    }
  }

  function renderDriver({ item }: { item: Driver }) {
    return (
      <TouchableOpacity
        style={[styles.driverCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/management/drivers/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.driverHeader}>
          {/* Photo */}
          <View style={[styles.avatar, { backgroundColor: colors.inputBg }]}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={22} color={colors.textMuted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.driverName, { color: colors.text }]}>{item.fullName}</Text>
            <Text style={[styles.driverVendor, { color: colors.textMuted }]}>
              {getVendorName(item.vendorId)}
            </Text>
            <Text style={[styles.driverPhone, { color: colors.textMuted }]}>
              {item.phone || 'No phone'}
            </Text>
          </View>
          <View style={styles.driverStatus}>
            <Badge
              label={item.status || 'unknown'}
              variant={getStatusVariant(item.status)}
              size="sm"
              dot
            />
            {item.availability && (
              <Badge label="Available" variant="success" size="sm" dot />
            )}
          </View>
        </View>
        {item.licenseNumber && (
          <View style={styles.driverMeta}>
            <Ionicons name="card-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.driverMetaText, { color: colors.textMuted }]}>
              License: {item.licenseNumber} ({item.licenseClass || 'N/A'})
            </Text>
          </View>
        )}
        {item.currentVehicleId && (
          <View style={styles.driverMeta}>
            <Ionicons name="car-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.driverMetaText, { color: colors.textMuted }]}>
              Vehicle: {item.currentVehicleId}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Drivers</Text>
        </View>
        <LoadingSkeleton lines={5} variant="card" />
      </View>
    );
  }

  const filtered = getFilteredDrivers();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Drivers</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {drivers.length} driver{drivers.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Button
            title="Add Driver"
            onPress={() => router.push('/management/drivers/create' as any)}
            icon="add-circle-outline"
            size="sm"
          />
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

        {/* Vendor Filter */}
        <Select
          label=""
          value={vendorFilter || ''}
          options={[
            { id: '', name: 'All Vendors' },
            ...vendors.map((v) => ({ id: v.id, name: v.companyName || v.id })),
          ]}
          onSelect={(v) => setVendorFilter(v || null)}
          placeholder="Filter by vendor..."
        />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={search || vendorFilter ? 'No drivers found' : 'No drivers yet'}
          subtitle={search || vendorFilter ? 'Try different search or filter' : 'Add your first driver'}
          actionLabel={search || vendorFilter ? undefined : 'Add Driver'}
          onAction={search || vendorFilter ? undefined : () => router.push('/management/drivers/create' as any)}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderDriver}
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
  list: {
    padding: Spacing.md,
    paddingTop: 0,
    paddingBottom: Spacing['4xl'],
  },
  driverCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
  },
  driverVendor: {
    fontSize: 12,
    marginTop: 1,
  },
  driverPhone: {
    fontSize: 12,
    marginTop: 1,
  },
  driverStatus: {
    gap: 4,
    alignItems: 'flex-end',
  },
  driverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  driverMetaText: {
    fontSize: 12,
  },
});
