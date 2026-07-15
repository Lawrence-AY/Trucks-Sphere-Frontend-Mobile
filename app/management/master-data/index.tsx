/**
 * Master Data Hub - Centralized management for all master data entities
 *
 * This is the administrative backbone of TruckSphere.
 * All reusable business data is managed from here.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { materialRepository } from '../../../services/repositories/MaterialRepository';
import { purchaseOrderRepository } from '../../../services/repositories/PurchaseOrderRepository';
import { vehicleRepository } from '../../../services/repositories/VehicleRepository';
import { driverRepository } from '../../../services/repositories/DriverRepository';

interface MDTile {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  count: number;
}

export default function MasterDataScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [tiles, setTiles] = useState<MDTile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCounts();
  }, []);

  async function loadCounts() {
    try {
      const [vendors, vehicles, materials, pos, drivers] = await Promise.all([
        vendorRepository.getAll(),
        vehicleRepository.getAll(),
        materialRepository.getAll(),
        purchaseOrderRepository.getAll(),
        driverRepository.getAll(),
      ]);

      setTiles([
        {
          key: 'vendors',
          label: 'Vendors',
          icon: 'business-outline',
          color: '#3B82F6',
          route: '/management/vendors',
          count: vendors.length,
        },
        {
          key: 'vehicles',
          label: 'Vehicles',
          icon: 'car-outline',
          color: '#10B981',
          route: '/management/vehicles',
          count: vehicles.length,
        },
        {
          key: 'drivers',
          label: 'Drivers',
          icon: 'people-outline',
          color: '#8B5CF6',
          route: '/management/drivers',
          count: drivers.length,
        },
        {
          key: 'materials',
          label: 'Materials',
          icon: 'cube-outline',
          color: '#F59E0B',
          route: '/management/materials',
          count: materials.length,
        },
        {
          key: 'purchase-orders',
          label: 'Purchase Orders',
          icon: 'document-text-outline',
          color: '#EF4444',
          route: '/management/purchase-orders',
          count: pos.length,
        },
        {
          key: 'quarries',
          label: 'Quarries',
          icon: 'map-outline',
          color: '#14B8A6',
          route: '/management/quarries',
          count: 0,
        },
        {
          key: 'sites',
          label: 'Sites',
          icon: 'location-outline',
          color: '#F97316',
          route: '/management/sites',
          count: 0,
        },
        {
          key: 'fuel-stations',
          label: 'Fuel Stations',
          icon: 'flame-outline',
          color: '#EC4899',
          route: '/management/fuel-stations',
          count: 0,
        },
        {
          key: 'users',
          label: 'Users',
          icon: 'person-circle-outline',
          color: '#6366F1',
          route: '/management/users',
          count: 0,
        },
        {
          key: 'roles',
          label: 'Roles & Permissions',
          icon: 'shield-checkmark-outline',
          color: '#84CC16',
          route: '/management/roles',
          count: 0,
        },
      ]);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={styles.backTitle}>Master Data</Text>
      </View>
      <View style={styles.header}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Manage all business data from one place
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {tiles.map((tile) => (
          <TouchableOpacity
            key={tile.key}
            style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(tile.route as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.tileIcon, { backgroundColor: tile.color + '15' }]}>
              <Ionicons name={tile.icon} size={24} color={tile.color} />
            </View>
            <Text style={[styles.tileLabel, { color: colors.text }]}>{tile.label}</Text>
            <View style={[styles.tileCount, { backgroundColor: tile.color + '20' }]}>
              <Text style={[styles.tileCountText, { color: tile.color }]}>{tile.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing['4xl'],
  },
  tile: {
    width: '47%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  tileCount: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  tileCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
});