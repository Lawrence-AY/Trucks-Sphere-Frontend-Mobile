/**
 * Global Search Screen - Instant search across all entities
 *
 * Features:
 *   - Search by PO, Job, Vendor, Driver, Vehicle, Material
 *   - Group results intelligently by type
 *   - Tap to navigate to result
 *   - Recent searches
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput, 
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from '../utils/router';
import { useTheme } from '../hooks/useTheme';
import { Gap, Radius, Spacing } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { vendorRepository } from '../services/repositories/VendorRepository';
import { driverRepository } from '../services/repositories/DriverRepository';
import { vehicleRepository } from '../services/repositories/VehicleRepository';
import { materialRepository } from '../services/repositories/MaterialRepository';
import { purchaseOrderRepository } from '../services/repositories/PurchaseOrderRepository';
import { jobRepository } from '../services/repositories/JobRepository';
import { SearchResult } from '@/store/types';

interface SearchGroup {
  title: string;
  icon: string;
  color: string;
  data: SearchResult[];
}



export default function SearchScreen() {
  const colors = useTheme();
const SEARCH_GROUPS: Record<string, { icon: string; color: string; route: (id: string) => string }> = {
  vendor: { icon: 'business-outline', color: colors.infoText, route: (id) => `/management/vendors/${id}` },
  driver: { icon: 'people-outline', color: colors.purpleText, route: (id) => `/management/drivers/${id}` },
  vehicle: { icon: 'car-outline', color: colors.success, route: (id) => `/management/vehicles/${id}` },
  material: { icon: 'cube-outline', color: colors.warningText, route: (id) => `/management/materials/${id}` },
  purchase_order: { icon: 'document-text-outline', color: colors.danger, route: (id) => `/management/purchase-orders/${id}` },
  job: { icon: 'briefcase-outline', color: colors.purpleText, route: (id) => `/operations/jobs/${id}` },
};
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    setSearched(true);

    try {
      const lower = q.toLowerCase();
      const [vendors, drivers, vehicles, materials, pos, jobs] = await Promise.all([
        vendorRepository.getAll(),
        driverRepository.getAll(),
        vehicleRepository.getAll(),
        materialRepository.getAll(),
        purchaseOrderRepository.getAll(),
        jobRepository.getAll(),
      ]);

      const groups: SearchGroup[] = [];

      // Vendors
      const matchedVendors = vendors.filter(
        (v) =>
          v.companyName?.toLowerCase().includes(lower) ||
          v.vendorId?.toLowerCase().includes(lower) ||
          v.contactPerson?.toLowerCase().includes(lower) ||
          v.phone?.includes(lower)
      );
      if (matchedVendors.length > 0) {
        groups.push({
          title: 'Vendors',
          icon: 'business-outline',
          color: colors.infoText,
          data: matchedVendors.map((v) => ({
            id: v.id,
            type: 'vendor',
            label: v.companyName || 'Unknown',
            subtitle: `${v.vendorId || ''} • ${v.contactPerson || ''}`,
            route: `/management/vendors/${v.id}`,
            icon: 'business-outline',
            color: colors.infoText,
          })),
        });
      }

      // Drivers
      const matchedDrivers = drivers.filter(
        (d) =>
          d.fullName?.toLowerCase().includes(lower) ||
          d.phone?.includes(lower) ||
          d.licenseNumber?.toLowerCase().includes(lower) ||
          d.driverId?.toLowerCase().includes(lower)
      );
      if (matchedDrivers.length > 0) {
        groups.push({
          title: 'Drivers',
          icon: 'people-outline',
          color: colors.purpleText,
          data: matchedDrivers.map((d) => ({
            id: d.id,
            type: 'driver',
            label: d.fullName || 'Unknown',
            subtitle: `${d.driverId || ''} • ${d.phone || ''}`,
            route: `/management/drivers/${d.id}`,
            icon: 'people-outline',
            color: colors.purpleText,
          })),
        });
      }

      // Vehicles
      const matchedVehicles = vehicles.filter(
        (v) =>
          v.registrationNumber?.toLowerCase().includes(lower) ||
          v.make?.toLowerCase().includes(lower) ||
          v.model?.toLowerCase().includes(lower)
      );
      if (matchedVehicles.length > 0) {
        groups.push({
          title: 'Vehicles',
          icon: 'car-outline',
          color: colors.success,
          data: matchedVehicles.map((v) => ({
            id: v.id,
            type: 'vehicle',
            label: v.registrationNumber || 'Unknown',
            subtitle: [v.make, v.model].filter(Boolean).join(' ') + (v.year ? ` (${v.year})` : ''),
            route: `/management/vehicles/${v.id}`,
            icon: 'car-outline',
            color: colors.success,
          })),
        });
      }

      // Materials
      const matchedMaterials = materials.filter(
        (m) =>
          m.name?.toLowerCase().includes(lower) ||
          m.category?.toLowerCase().includes(lower)
      );
      if (matchedMaterials.length > 0) {
        groups.push({
          title: 'Materials',
          icon: 'cube-outline',
          color: colors.warningText,
          data: matchedMaterials.map((m) => ({
            id: m.id,
            type: 'material',
            label: m.name || 'Unknown',
            subtitle: `${m.category || ''} • ${m.defaultUnit || ''}`,
            route: `/management/materials/${m.id}`,
            icon: 'cube-outline',
            color: colors.warningText,
          })),
        });
      }

      // Purchase Orders
      const matchedPOs = pos.filter(
        (p) =>
          p.poNumber?.toLowerCase().includes(lower) ||
          p.vendorName?.toLowerCase().includes(lower) ||
          p.materialName?.toLowerCase().includes(lower)
      );
      if (matchedPOs.length > 0) {
        groups.push({
          title: 'Purchase Orders',
          icon: 'document-text-outline',
          color: colors.danger,
          data: matchedPOs.map((p) => ({
            id: p.id,
            type: 'purchase_order',
            label: p.poNumber || p.id,
            subtitle: `${p.vendorName || ''} • ${p.materialName || ''}`,
            route: `/management/purchase-orders/${p.id}`,
            icon: 'document-text-outline',
            color: colors.danger,
          })),
        });
      }

      // Jobs
      const matchedJobs = jobs.filter(
        (j) =>
          j.jobId?.toLowerCase().includes(lower) ||
          j.poNumber?.toLowerCase().includes(lower) ||
          j.vendorName?.toLowerCase().includes(lower) ||
          j.driverName?.toLowerCase().includes(lower) ||
          j.materialName?.toLowerCase().includes(lower)
      );
      if (matchedJobs.length > 0) {
        groups.push({
          title: 'Jobs',
          icon: 'briefcase-outline',
          color: colors.purpleText,
          data: matchedJobs.map((j) => ({
            id: j.id,
            type: 'job',
            label: j.jobId || j.id.slice(0, 8),
            subtitle: `${j.materialName || ''} • ${j.vendorName || ''}`,
            route: `/operations/jobs/${j.id}`,
            icon: 'briefcase-outline',
            color: colors.purpleText,
          })),
        });
      }

      setResults(groups);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(text), 300);
  }

  function handleResultPress(result: SearchResult) {
    router.push(result.route as any);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search vendors, drivers, vehicles, POs, jobs..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => { setQuery(''); (() => router.back())(); }}>
          <Text style={[styles.cancelBtn, { color: colors.primaryText }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {searching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primaryText} />
          <Text style={[styles.searchingText, { color: colors.textMuted }]}>Searching...</Text>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.title}
          renderItem={({ item: group }) => (
            <View style={styles.group}>
              <View style={styles.groupHeader}>
                <Ionicons name={group.icon as any} size={18} color={group.color} />
                <Text style={[styles.groupTitle, { color: colors.text }]}>{group.title}</Text>
                <Text style={[styles.groupCount, { color: colors.textMuted }]}>({group.data.length})</Text>
              </View>
              {group.data.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={[styles.resultItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleResultPress(result)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.resultIcon, { backgroundColor: result.color + '15' }]}>
                    <Ionicons name={result.icon as any} size={18} color={result.color} />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultLabel, { color: colors.text }]} numberOfLines={1}>
                      {result.label}
                    </Text>
                    <Text style={[styles.resultSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                      {result.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          contentContainerStyle={styles.resultsList}
        />
      ) : searched ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.noResults, { color: colors.text }]}>No results found</Text>
          <Text style={[styles.noResultsSub, { color: colors.textMuted }]}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.noResults, { color: colors.text }]}>Search TruckSphere</Text>
          <Text style={[styles.noResultsSub, { color: colors.textMuted }]}>
            Search across vendors, drivers, vehicles, materials, POs, and jobs
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    gap: Gap,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Gap,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  cancelBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  searchingText: {
    fontSize: 14, marginTop: Spacing.xs,
  },
  noResults: {
    fontSize: 18,
    fontWeight: '700', marginTop: Spacing.xs,
  },
  noResultsSub: {
    fontSize: 14, marginTop: Spacing.xs,
    textAlign: 'center',
  },
  resultsList: {
    padding: Spacing.md,
    paddingBottom: Spacing['4xl'],
  },
  group: { marginBottom: Spacing.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap, marginBottom: Spacing.xs,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  groupCount: {
    fontSize: 13,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Gap,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultSubtitle: {
    fontSize: 12, marginTop: Spacing.xs,
  },
});
