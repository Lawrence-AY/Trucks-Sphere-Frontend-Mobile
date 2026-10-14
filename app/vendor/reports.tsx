import { ReportActions } from '../../components/ReportActions';
import { FulfilledPurchaseOrders } from '../../components/FulfilledPurchaseOrders';
import { useRealtimeCollection } from '@/store/realtimeData';
import { useAuthStore } from '@/store/authStore';
import { normalizeVendorId } from '../../utils/helpers';
/**
 * Vendor Reports Screen
 *
 * Allows vendor users to download CSV reports of their own data.
 * Categories: Deliveries, Drivers, Trucks, Fuel, Purchase Orders.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Gap, Radius, Spacing } from '../../constants/theme';
import { PageShell, } from '../../components/EnterpriseUI';
import { downloadVendorCategoryCSV } from '../../services/api';
import { DateRangeFilter, defaultDateRange, DateRange } from '../../components/DateRangeFilter';

const VENDOR_CATEGORIES = [
  { key: 'fulfilled-purchase-orders', label: 'Fulfilled Purchase Orders', icon: 'checkmark-done-outline', color: '#10B981' },
  { key: 'deliveries', label: 'Deliveries', icon: 'cube-outline', color: '#2563EB' },
  { key: 'drivers', label: 'Drivers', icon: 'people-outline', color: '#10B981' },
  { key: 'trucks', label: 'Trucks', icon: 'car-outline', color: '#EC4899' },
  { key: 'fuel', label: 'Fuel', icon: 'water-outline', color: '#F59E0B' },
  { key: 'purchase-orders', label: 'Purchase Orders', icon: 'document-text-outline', color: '#0EA5E9' },
];

const FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export default function VendorReportsScreen() {
  const colors = useTheme();
  const vendorId = useAuthStore(state => state.user?.vendorId || '');
  const { data: purchaseOrders } = useRealtimeCollection('purchaseOrders');
  const vendorOrders = purchaseOrders.filter(order => normalizeVendorId(order.vendorId) === normalizeVendorId(vendorId));
  const [filter, setFilter] = useState('all');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());

  const handleDownload = async (category: string) => {
    setDownloading(category);
    try {
      await downloadVendorCategoryCSV(category, {
        filter: filter !== 'all' ? filter : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
    } catch (error: any) {
      Alert.alert('Download Failed', error?.message || 'Could not download the report.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <PageShell>
      <DateRangeFilter value={dateRange} onApply={setDateRange} />
    
      {/* Time filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f.key ? colors.primary : colors.surface,
                borderColor: filter === f.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filter === f.key ? colors.onPrimary : colors.textSecondary },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ReportActions categories={VENDOR_CATEGORIES.map(c => ({ ...c, label: c.label + ' CSV' }))} busy={downloading !== null} onExport={handleDownload} />
      <FulfilledPurchaseOrders orders={vendorOrders} />

      <View style={{ height: Spacing['4xl'] }} />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14, marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  filterScroll: { marginBottom: Spacing.xs},
  filterRow: { gap: Gap, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Gap, marginTop: Spacing.xs,
  },
  categoryCard: {
    width: '47%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Gap,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  downloadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full, marginTop: Spacing.xs,
  },
  downloadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
