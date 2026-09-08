import { PurchaseOrderMaterials } from '../../../components/PurchaseOrderMaterials';
/**
 * Purchase Order List Screen - Full CRUD with workflow
 *
 * Features:
 *   - List all POs with status badges
 *   - Search by PO number, vendor, material
 *   - Create new PO
 *   - Tap to view/edit PO details
 *   - Pull to refresh
 *   - Status workflow: Draft → Approved → In Progress → Completed → Archived
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
import { router } from '../../../utils/router';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { purchaseOrderRepository } from '../../../services/repositories/PurchaseOrderRepository';
import { PurchaseOrder } from '../../../store/types';
import { useAuthStore } from '../../../store/authStore';
import { formatEAT, formatNumber } from '../../../utils/helpers';
import { hasManagementPermission } from '../../../utils/access';
import { ManagementSearchHeader } from '../../../components/ManagementSearchHeader';



export default function PurchaseOrderListScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filtered, setFiltered] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const canCreatePurchaseOrder = hasManagementPermission(user?.role, 'purchaseOrders.create');

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [search, orders]);

  async function loadOrders() {
    try {
      const data = await purchaseOrderRepository.getAll();
      setOrders(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    purchaseOrderRepository.invalidateCache();
    await loadOrders();
    setRefreshing(false);
  }

  function filterOrders() {
    let result = orders.filter((po) => String(po.status || '').toLowerCase() !== 'cancelled');
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (po) =>
          po.poNumber?.toLowerCase().includes(q) ||
          po.vendorName?.toLowerCase().includes(q) ||
          po.materialName?.toLowerCase().includes(q) ||
          po.materials?.some((line) => line.materialName?.toLowerCase().includes(q)) ||
          po.id?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }

  function getStatusBadge(status?: string) {
    
    return <></>;
  }

  function getProgress(po: PurchaseOrder): number {
    if (!po.quantity) return 0;
    const delivered = po.quantityDelivered || 0;
    return Math.min(100, Math.round((delivered / po.quantity) * 100));
  }

  function renderPO({ item }: { item: PurchaseOrder }) {
    const progress = getProgress(item);
    const materialLines = item.materials?.length ? item.materials : [{ materialName: item.materialName, materialNumber: item.materialNumber, quantity: item.quantity, unit: item.unit }];
    return (
      <TouchableOpacity
        style={[styles.poCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/management/purchase-orders/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.poHeader}>
          <View style={styles.poInfo}>
            <Text style={[styles.poNumber, { color: colors.text }]}>
              {String(item.poNumber || item.id || '').toUpperCase()}
            </Text>
            <Text style={[styles.poVendor, { color: colors.textMuted }]} numberOfLines={1}>
              {item.companyName || item.vendorName || 'Unknown Vendor'}
            </Text>
          </View>
          {getStatusBadge(item.status)}
        </View>

        <PurchaseOrderMaterials order={item} />

        <View style={styles.poFooter}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Created {item.createdAt ? formatEAT(item.createdAt) : '-'}
          </Text>
          {item.jobCount !== undefined && (
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              {item.jobCount} job{item.jobCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContent} />
        <LoadingSkeleton lines={5} variant="card" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ManagementSearchHeader title="Purchase Orders" search={search} onChangeSearch={setSearch} placeholder="Search POs..." />
      <View style={styles.header}>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderPO}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title={search ? 'No POs found' : 'No purchase orders yet'}
            subtitle={search ? 'Try a different search term' : 'Create your first purchase order'}
          />
        }
      />
      {canCreatePurchaseOrder && (
        <TouchableOpacity
          style={[styles.createFab, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/management/purchase-orders/create' as any)}
          accessibilityRole="button"
          accessibilityLabel="Create purchase order"
        >
          <Ionicons name="add" size={23} color="#FFFFFF" />
          <Text style={styles.createFabText}>Create PO</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContent: {
    height: Spacing.sm,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.xs,
  },
  count: {
    fontSize: 13, marginTop: Spacing.xs,
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
    paddingBottom: 104,
  },
  createFab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    minHeight: 52,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    elevation: 5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  createFabText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  poCard: {
    borderRadius: 5,
    borderWidth: 1,
    padding: Spacing.md, marginBottom: Spacing.xs,
  },
  poHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.xs,
  },
  poInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  poNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  poVendor: {
    fontSize: 13, marginTop: Spacing.xs,
  },
  poMeta: {
    flexDirection: 'column',
    gap: 5, marginBottom: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  progressSection: { marginBottom: Spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontSize: 11,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  poFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 11,
  },
});
