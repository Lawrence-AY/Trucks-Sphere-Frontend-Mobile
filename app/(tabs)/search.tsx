import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchPurchaseOrders, fetchDeliveryOrders, fetchDrivers, fetchVehicles } from '../../services/api';
import { formatEAT, getStatusColor, formatStatus } from '../../utils/helpers';

type SearchCategory = 'all' | 'orders' | 'deliveries' | 'drivers' | 'trucks';

interface FilterState {
  dateFrom: string;
  dateTo: string;
  truck: string;
  driver: string;
  jobId: string;
  poNumber: string;
  vendor: string;
}

export default function SearchScreen() {
  const colors = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [category, setCategory] = useState<SearchCategory>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: '', dateTo: '', truck: '', driver: '', jobId: '', poNumber: '', vendor: '',
  });

  const categories: { key: SearchCategory; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'apps-outline' },
    { key: 'orders', label: 'Orders', icon: 'document-text-outline' },
    { key: 'deliveries', label: 'Deliveries', icon: 'navigate-outline' },
    { key: 'drivers', label: 'Drivers', icon: 'people-outline' },
    { key: 'trucks', label: 'Trucks', icon: 'car-outline' },
  ];

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', truck: '', driver: '', jobId: '', poNumber: '', vendor: '' });
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const matchesFilters = (item: any, type: string): boolean => {
    const q = query.toLowerCase();
    const f = filters;

    // Text query match
    if (query) {
      const searchable = [
        item.poNumber, item.jobId, item.vendorName, item.driverName,
        item.plateNumber, item.materialName, item.name, item.phone,
        item.licenseNumber, item.model, item.make,
      ].filter(Boolean).map(s => s.toLowerCase());
      const matchesQuery = searchable.some(s => s.includes(q));
      if (!matchesQuery) return false;
    }

    // Filter matches
    if (f.dateFrom || f.dateTo) {
      const itemDate = new Date(item.createdAt || item.updatedAt || 0);
      if (f.dateFrom && itemDate < new Date(f.dateFrom)) return false;
      if (f.dateTo) {
        const endDate = new Date(f.dateTo);
        endDate.setHours(23, 59, 59, 999);
        if (itemDate > endDate) return false;
      }
    }

    if (f.truck && !(item.plateNumber || '').toLowerCase().includes(f.truck.toLowerCase())) return false;
    if (f.driver && !(item.driverName || item.name || '').toLowerCase().includes(f.driver.toLowerCase())) return false;
    if (f.jobId && !(item.jobId || '').toLowerCase().includes(f.jobId.toLowerCase())) return false;
    if (f.poNumber && !(item.poNumber || '').toLowerCase().includes(f.poNumber.toLowerCase())) return false;
    if (f.vendor && !(item.vendorName || '').toLowerCase().includes(f.vendor.toLowerCase())) return false;

    return true;
  };

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);

    try {
      const q = query.toLowerCase();
      let allResults: any[] = [];

      if (category === 'all' || category === 'orders') {
        const orders = await fetchPurchaseOrders({ search: q });
        (orders || []).forEach((o: any) => allResults.push({ ...o, _type: 'order' }));
      }
      if (category === 'all' || category === 'deliveries') {
        const deliveries = await fetchDeliveryOrders();
        (deliveries || []).forEach((d: any) => allResults.push({ ...d, _type: 'delivery' }));
      }
      if (category === 'all' || category === 'drivers') {
        const drivers = await fetchDrivers();
        (drivers || []).forEach((d: any) => allResults.push({ ...d, _type: 'driver' }));
      }
      if (category === 'all' || category === 'trucks') {
        const trucks = await fetchVehicles();
        (trucks || []).forEach((t: any) => allResults.push({ ...t, _type: 'truck' }));
      }

      // Apply filters
      const filtered = allResults.filter(item => matchesFilters(item, item._type));
      setResults(filtered);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'order': return 'document-text-outline';
      case 'delivery': return 'navigate-outline';
      case 'driver': return 'person-outline';
      case 'truck': return 'car-outline';
      default: return 'ellipse-outline';
    }
  };

  const getResultColor = (type: string) => {
    switch (type) {
      case 'order': return '#1B2A4A';
      case 'delivery': return '#7C3AED';
      case 'driver': return '#10B981';
      case 'truck': return '#D97706';
      default: return '#64748B';
    }
  };

  const handleResultPress = (item: any) => {
    switch (item._type) {
      case 'order':
        router.push(`/screens/purchase-order?id=${item.id}`);
        break;
      case 'delivery':
        router.push(`/screens/job-details?id=${item.jobId}`);
        break;
      case 'driver':
        router.push(`/screens/driver-history?id=${item.id}&name=${encodeURIComponent(item.name || '')}`);
        break;
      default:
        break;
    }
  };

  // Group results by type
  const groupedResults = results.reduce((groups: Record<string, any[]>, item) => {
    const type = item._type || 'other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(item);
    return groups;
  }, {});

  const typeLabels: Record<string, string> = {
    order: 'Purchase Orders',
    delivery: 'Deliveries',
    driver: 'Drivers',
    truck: 'Trucks',
  };

  const renderResult = ({ item }: { item: any }) => {
    const color = getResultColor(item._type);
    return (
      <TouchableOpacity
        style={[styles.resultCard, { backgroundColor: colors.surface }]}
        onPress={() => handleResultPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.resultIcon, { backgroundColor: color + '12' }]}>
          <Ionicons name={getResultIcon(item._type) as any} size={20} color={color} />
        </View>
        <View style={styles.resultInfo}>
          <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
            {item._type === 'order' ? item.poNumber || item.id :
             item._type === 'delivery' ? item.jobId :
             item._type === 'driver' ? item.name :
             item._type === 'truck' ? item.plateNumber : item.id}
          </Text>
          <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {item._type === 'order' ? `${item.vendorName || ''} · ${item.materialName || ''}` :
             item._type === 'delivery' ? `${item.driverName || ''} · ${item.plateNumber || ''}` :
             item._type === 'driver' ? `${item.phone || ''} · ${item.licenseNumber || ''}` :
             item._type === 'truck' ? `${item.model || ''} · ${item.make || ''}` : ''}
          </Text>
          <View style={styles.resultMeta}>
            <View style={[styles.resultTypeBadge, { backgroundColor: color + '12' }]}>
              <Text style={[styles.resultTypeText, { color }]}>{item._type}</Text>
            </View>
            {item.status && (
              <Text style={[styles.resultStatus, { color: getStatusColor(item.status) }]}>
                {formatStatus(item.status)}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderGroupedResults = () => {
    const entries = Object.entries(groupedResults);
    if (entries.length === 0) {
      return (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="search-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No results found</Text>
          <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
            Try a different search term or adjust filters
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={entries}
        keyExtractor={([type]) => type}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: [type, items] }) => (
          <View style={styles.groupSection}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupBadge, { backgroundColor: getResultColor(type) + '12' }]}>
                <Ionicons name={getResultIcon(type) as any} size={14} color={getResultColor(type)} />
              </View>
              <Text style={[styles.groupTitle, { color: colors.text }]}>
                {typeLabels[type] || type}
              </Text>
              <Text style={[styles.groupCount, { color: colors.textMuted }]}>({items.length})</Text>
            </View>
            {items.map((item: any) => (
              <View key={`${item._type}-${item.id}`}>
                {renderResult({ item })}
              </View>
            ))}
          </View>
        )}
      />
    );
  };

  const hasActiveFilters = Object.values(filters).some(v => v.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.searchSection}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {/* Search Bar */}
        <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search orders, deliveries, drivers..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills */}
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(c) => c.key}
          contentContainerStyle={styles.categories}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              style={[
                styles.categoryPill,
                {
                  backgroundColor: category === cat.key ? colors.primary : colors.surface,
                  borderColor: category === cat.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setCategory(cat.key)}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={category === cat.key ? '#FFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.categoryText,
                  { color: category === cat.key ? '#FFF' : colors.textSecondary },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Filter Toggle */}
        <TouchableOpacity
          style={[styles.filterToggle, { backgroundColor: colors.surface, borderColor: hasActiveFilters ? colors.primary : colors.border }]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={hasActiveFilters ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.filterToggleText, { color: hasActiveFilters ? colors.primary : colors.textSecondary }]}>
            {hasActiveFilters ? 'Filters Active' : 'Advanced Filters'}
          </Text>
          <Ionicons
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Advanced Filters */}
        {showFilters && (
          <View style={[styles.filtersPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Date From</Text>
                <TextInput
                  style={[styles.filterInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  value={filters.dateFrom}
                  onChangeText={(v) => updateFilter('dateFrom', v)}
                />
              </View>
              <View style={styles.filterField}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Date To</Text>
                <TextInput
                  style={[styles.filterInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  value={filters.dateTo}
                  onChangeText={(v) => updateFilter('dateTo', v)}
                />
              </View>
            </View>
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Truck Plate</Text>
                <TextInput
                  style={[styles.filterInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. KCA 123A"
                  placeholderTextColor={colors.textTertiary}
                  value={filters.truck}
                  onChangeText={(v) => updateFilter('truck', v)}
                />
              </View>
              <View style={styles.filterField}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Driver</Text>
                <TextInput
                  style={[styles.filterInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Driver name"
                  placeholderTextColor={colors.textTertiary}
                  value={filters.driver}
                  onChangeText={(v) => updateFilter('driver', v)}
                />
              </View>
            </View>
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Job ID</Text>
                <TextInput
                  style={[styles.filterInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. JOB-2025-0001"
                  placeholderTextColor={colors.textTertiary}
                  value={filters.jobId}
                  onChangeText={(v) => updateFilter('jobId', v)}
                />
              </View>
              <View style={styles.filterField}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>PO Number</Text>
                <TextInput
                  style={[styles.filterInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. PO-2025-001"
                  placeholderTextColor={colors.textTertiary}
                  value={filters.poNumber}
                  onChangeText={(v) => updateFilter('poNumber', v)}
                />
              </View>
            </View>
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Vendor</Text>
                <TextInput
                  style={[styles.filterInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Vendor name"
                  placeholderTextColor={colors.textTertiary}
                  value={filters.vendor}
                  onChangeText={(v) => updateFilter('vendor', v)}
                />
              </View>
              <View style={styles.filterField}>
                <TouchableOpacity
                  style={[styles.clearFiltersBtn, { borderColor: colors.danger }]}
                  onPress={clearFilters}
                >
                  <Ionicons name="close-outline" size={16} color={colors.danger} />
                  <Text style={[styles.clearFiltersText, { color: colors.danger }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Search Button */}
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.primary }]}
          onPress={handleSearch}
        >
          <Ionicons name="search" size={18} color="#FFF" />
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Searching...</Text>
        </View>
      ) : searched ? (
        renderGroupedResults()
      ) : (
        <View style={styles.initialState}>
          <View style={[styles.initialIcon, { backgroundColor: colors.primary + '08' }]}>
            <Ionicons name="search" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.initialText, { color: colors.textSecondary }]}>
            Search across all records
          </Text>
          <Text style={[styles.initialSubtext, { color: colors.textMuted }]}>
            Find purchase orders, deliveries, drivers, and trucks
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchSection: { padding: Spacing.lg, paddingBottom: Spacing.sm, maxHeight: '50%' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 46, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  categories: { gap: Spacing.sm, paddingVertical: Spacing.md },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1,
  },
  categoryText: { fontSize: 12, fontWeight: '600' },
  filterToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, marginBottom: Spacing.sm,
  },
  filterToggleText: { fontSize: 13, fontWeight: '600' },
  filtersPanel: {
    borderRadius: Radius.md, borderWidth: 1,
    padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  filterField: { flex: 1 },
  filterLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  filterInput: {
    borderWidth: 1, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    fontSize: 13, height: 36,
  },
  clearFiltersBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderWidth: 1, borderRadius: Radius.sm,
    paddingVertical: 6, paddingHorizontal: Spacing.md, marginTop: 20, height: 36,
  },
  clearFiltersText: { fontSize: 12, fontWeight: '600' },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    borderRadius: Radius.md, marginTop: Spacing.xs,
  },
  searchBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  loadingWrap: { alignItems: 'center', paddingVertical: 80, gap: Spacing.md },
  loadingText: { fontSize: 14 },
  resultsList: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  groupSection: { marginBottom: Spacing.lg },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  groupBadge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  groupTitle: { fontSize: 15, fontWeight: '700' },
  groupCount: { fontSize: 13 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.sm, gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '700' },
  resultSubtitle: { fontSize: 12, marginTop: 2 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  resultTypeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  resultTypeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  resultStatus: { fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
  initialState: { alignItems: 'center', paddingVertical: 100, gap: Spacing.sm },
  initialIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  initialText: { fontSize: 16, fontWeight: '600' },
  initialSubtext: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
