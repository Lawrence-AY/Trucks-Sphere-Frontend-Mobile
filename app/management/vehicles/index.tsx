/**
 * Vehicles List Screen - Full CRUD with vendor filtering
 *
 * Features:
 *   - List all vehicles with status indicators
 *   - Filter by vendor
 *   - Search by registration, make, model
 *   - Create new vehicle
 *   - Tap to view/edit vehicle details
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
import { vehicleRepository } from '../../../services/repositories/VehicleRepository';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { Vehicle, Vendor } from '../../../store/types';

export default function VehiclesListScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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
      const [v, vend] = await Promise.all([
        vehicleRepository.getAll(),
        vendorRepository.getAll(),
      ]);
      setVehicles(v);
      setVendors(vend);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    vehicleRepository.invalidateCache();
    vendorRepository.invalidateCache();
    await loadData();
    setRefreshing(false);
  }

  function getFilteredVehicles(): Vehicle[] {
    let result = [...vehicles];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.registrationNumber?.toLowerCase().includes(q) ||
          v.make?.toLowerCase().includes(q) ||
          v.model?.toLowerCase().includes(q)
      );
    }
    if (vendorFilter) {
      result = result.filter((v) => v.vendorId === vendorFilter);
    }
    return result;
  }

  function getVendorName(vendorId?: string): string {
    if (!vendorId) return 'Unknown';
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.companyName || 'Unknown';
  }

  function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'default' | 'info' {
    switch (status) {
      case 'active': return 'success';
      case 'on_trip': return 'info';
      case 'in_maintenance': return 'warning';
      case 'inactive':
      case 'out_of_service': return 'danger';
      default: return 'default';
    }
  }

  function isComplianceExpired(vehicle: Vehicle): boolean {
    const now = new Date();
    const insExp = vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry) : null;
    const inspExp = vehicle.inspectionExpiry ? new Date(vehicle.inspectionExpiry) : null;
    return (insExp !== null && insExp < now) || (inspExp !== null && inspExp < now);
  }

  function renderVehicle({ item }: { item: Vehicle }) {
    const expired = isComplianceExpired(item);
    return (
      <TouchableOpacity
        style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/management/vehicles/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.vehicleHeader}>
          <View style={[styles.vehicleIcon, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="car-outline" size={22} color={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.vehicleReg, { color: colors.text }]}>
              {item.registrationNumber || 'No Plate'}
            </Text>
            <Text style={[styles.vehicleVendor, { color: colors.textMuted }]}>
              {getVendorName(item.vendorId)}
            </Text>
            <Text style={[styles.vehicleModel, { color: colors.textMuted }]}>
              {item.make} {item.model} ({item.year})
            </Text>
          </View>
          <View style={styles.vehicleStatus}>
            <Badge
              label={item.status || 'unknown'}
              variant={getStatusVariant(item.status)}
              size="sm"
              dot
            />
            {expired && (
              <Badge label="Compliance" variant="danger" size="sm" dot />
            )}
          </View>
        </View>
        <View style={styles.vehicleMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="scale-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {item.capacity || '?'} {item.capacityUnit || 'tonnes'}
            </Text>
          </View>
          {item.currentDriverName && (
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
                {item.currentDriverName}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Vehicles</Text>
        </View>
        <LoadingSkeleton lines={5} variant="card" />
      </View>
    );
  }

  const filtered = getFilteredVehicles();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Vehicles</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Button
            title="Add Vehicle"
            onPress={() => router.push('/management/vehicles/create' as any)}
            icon="add-circle-outline"
            size="sm"
          />
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search vehicles..."
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
          icon="car-outline"
          title={search || vendorFilter ? 'No vehicles found' : 'No vehicles yet'}
          subtitle={search || vendorFilter ? 'Try different search or filter' : 'Add your first vehicle'}
          actionLabel={search || vendorFilter ? undefined : 'Add Vehicle'}
          onAction={search || vendorFilter ? undefined : () => router.push('/management/vehicles/create' as any)}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicle}
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
  vehicleCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleReg: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vehicleVendor: {
    fontSize: 12,
    marginTop: 1,
  },
  vehicleModel: {
    fontSize: 12,
    marginTop: 1,
  },
  vehicleStatus: {
    gap: 4,
    alignItems: 'flex-end',
  },
  vehicleMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
});
