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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { purchaseOrderRepository } from '../../../services/repositories/PurchaseOrderRepository';
import { PurchaseOrder } from '../../../store/types';
import { useAuthStore } from '../../../store/authStore';
import { formatEAT, formatNumber } from '../../../utils/helpers';
import { hasManagementPermission } from '../../../utils/access';

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; label: string }> = {
  draft: { variant: 'default', label: 'Draft' },
  approved: { variant: 'info', label: 'Approved' },
  in_progress: { variant: 'purple', label: 'In Progress' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  archived: { variant: 'default', label: 'Archived' },
};

export default function PurchaseOrderListScreen() {
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filtered, setFiltered] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const canCreatePurchaseOrder = hasManagementPermission(user?.role, 'purchaseOrders.create');
  const canEditPurchaseOrder = hasManagementPermission(user?.role, 'purchaseOrders.edit');

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
    let result = [...orders];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (po) =>
          po.poNumber?.toLowerCase().includes(q) ||
          po.vendorName?.toLowerCase().includes(q) ||
          po.materialName?.toLowerCase().includes(q) ||
          po.id?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }

  function getStatusBadge(status?: string) {
    const config = STATUS_BADGE[status || ''] || { variant: 'default' as const, label: status || 'Unknown' };
    return <Badge label={config.label} variant={config.variant} size="sm" dot />;
  }

  function getProgress(po: PurchaseOrder): number {
    if (!po.quantity) return 0;
    const delivered = po.quantityDelivered || 0;
    return Math.min(100, Math.round((delivered / po.quantity) * 100));
  }

  function renderPO({ item }: { item: PurchaseOrder }) {
    const progress = getProgress(item);
    return (
      <TouchableOpacity
        style={[styles.poCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/management/purchase-orders/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.poHeader}>
          <View style={styles.poInfo}>
            <Text style={[styles.poNumber, { color: colors.text }]}>
              {item.poNumber || item.id}
            </Text>
            <Text style={[styles.poVendor, { color: colors.textMuted }]} numberOfLines={1}>
              {item.companyName || item.vendorName || 'Unknown Vendor'}
            </Text>
          </View>
          {getStatusBadge(item.status)}
        </View>

        <View style={styles.poMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
              {item.materialName || 'Unknown Material'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="scale-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {formatNumber(item.quantity || 0)} {item.unit || 'units'}
            </Text>
          </View>
        </View>

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

        {/* Action Buttons */}
        {canEditPurchaseOrder && item.status !== 'completed' && item.status !== 'cancelled' && item.status !== 'archived' && (
          <View style={styles.poActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
              onPress={() => router.push(`/management/purchase-orders/edit/${item.id}` as any)}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
              onPress={async () => {
                Alert.alert(
                  'Cancel Order',
                  `Are you sure you want to cancel PO ${item.poNumber || item.id}?`,
                  [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Yes, Cancel',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await purchaseOrderRepository.update(item.id, { status: 'cancelled' });
                          loadOrders();
                        } catch (err) {
                          Alert.alert('Error', 'Failed to cancel purchase order');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Purchase Orders</Text>
        </View>
        <LoadingSkeleton lines={5} variant="card" />
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
        <Text style={styles.backTitle}>Purchase Orders</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {orders.length} PO{orders.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {canCreatePurchaseOrder && (
            <Button
              title="Create PO"
              onPress={() => router.push('/management/purchase-orders/create' as any)}
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
            placeholder="Search POs..."
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
            actionLabel={!search && canCreatePurchaseOrder ? 'Create PO' : undefined}
            onAction={!search && canCreatePurchaseOrder ? () => router.push('/management/purchase-orders/create' as any) : undefined}
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
  poCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  poHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
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
    fontSize: 13,
    marginTop: 2,
  },
  poMeta: {
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
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  poActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
