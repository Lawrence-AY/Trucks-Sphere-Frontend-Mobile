/**
 * Purchase Order Detail Screen - Full workflow management
 *
 * Features:
 *   - View PO details
 *   - Edit PO (if in Draft status)
 *   - Approve PO (Draft → Approved)
 *   - Cancel PO (any status → Cancelled)
 *   - Archive PO (Completed → Archived)
 *   - Cancel PO (soft delete - sets status to cancelled)
 *   - View delivery progress
 *   - View associated jobs
 *   - Audit log
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { router } from '../../../utils/router';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { purchaseOrderRepository } from '../../../services/repositories/PurchaseOrderRepository';
import { PurchaseOrder } from '../../../store/types';
import { formatEAT, formatNumber } from '../../../utils/helpers';
import { StackScreen } from '../../../components/ui/StackScreen';
import { useAuthStore } from '../../../store/authStore';
import { hasManagementPermission } from '../../../utils/access';

const BASE_PO_TABS = [
  { name: 'details', label: 'Details', icon: 'information-circle-outline' as const },
  // 'jobs' tab intentionally hidden from users
];

export default function PurchaseOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const canEditPurchaseOrder = hasManagementPermission(user?.role, 'purchaseOrders.edit');
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [actionLoading, setActionLoading] = useState(false);

  // Confirm dialogs
  const [showCancel, setShowCancel] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (id) loadPO();
  }, [id]);

  async function loadPO() {
    setLoading(true);
    try {
      const result = await purchaseOrderRepository.getWithProgress(id!);
      setPo(result.po);
    } catch {
      Alert.alert('Error', 'Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  }

  // ─── Workflow Actions ───

  async function handleCancel() {
    setActionLoading(true);
    try {
      await purchaseOrderRepository.cancel(id!);
      setShowCancel(false);
      Alert.alert(
        'Purchase order cancelled',
        'This purchase order has been removed from the active purchase order list.',
        [{ text: 'OK', onPress: () => router.replace('/management/purchase-orders' as any) }]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to cancel');
    } finally {
      setActionLoading(false);
      setShowCancel(false);
    }
  }

  async function handleArchive() {
    setActionLoading(true);
    try {
      await purchaseOrderRepository.archive(id!);
      Alert.alert('Archived', 'Purchase order has been archived');
      loadPO();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to archive');
    } finally {
      setActionLoading(false);
      setShowArchive(false);
    }
  }

  async function handleDelete() {
    setActionLoading(true);
    try {
      // Soft delete - set status to cancelled instead of permanent delete
      await purchaseOrderRepository.cancel(id!);
      Alert.alert('Cancelled', 'Purchase order has been cancelled', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to cancel purchase order');
    } finally {
      setActionLoading(false);
      setShowDelete(false);
    }
  }

  // ─── Available Actions Based on Status ───

  function renderActions() {
    if (!po || !canEditPurchaseOrder) return null;
    const status = po.status;

    if (status !== 'completed') return null;

    return (
      <View style={styles.actionsRow}>
        <Button
          title="Archive"
          onPress={() => setShowArchive(true)}
          variant="secondary"
          size="sm"
          icon="archive-outline"
        />
      </View>
    );
  }

  if (loading) {
    return <StackScreen title="Purchase order" fallbackHref="/management/purchase-orders" loading />;
  }

  if (!po) {
    return <StackScreen title="Purchase order" fallbackHref="/management/purchase-orders" error="This purchase order is unavailable." onRetry={loadPO} />;
  }

  const purchaseOrderId = po.id;
  const canCancelPurchaseOrder = canEditPurchaseOrder && !['completed', 'cancelled', 'archived'].includes(po.status);
  const poTabs = [
    ...BASE_PO_TABS,
    ...(canEditPurchaseOrder && po.status === 'draft'
      ? [{ name: 'edit', label: 'Edit', icon: 'create-outline' as const }]
      : []),
    ...(canCancelPurchaseOrder
      ? [{ name: 'cancel', label: 'Cancel', icon: 'close-circle-outline' as const, tone: 'danger' as const }]
      : []),
  ];

  function handleTabChange(tabName: string) {
    if (tabName === 'edit') {
      router.push(`/management/purchase-orders/edit/${purchaseOrderId}` as any);
      return;
    }
    if (tabName === 'cancel') {
      setShowCancel(true);
      return;
    }
    setActiveTab(tabName);
  }

  return (
    <>
      <StackScreen
        title="Purchase order"
        subtitle={po.poNumber || po.id}
        fallbackHref="/management/purchase-orders"
        contentStyle={styles.content}
      >
      

        {/* Tabs */}
        <Tabs tabs={poTabs} activeTab={activeTab} onTabChange={handleTabChange} />
        {renderActions() ? <View style={styles.tabActions}>{renderActions()}</View> : null}

        {/* Tab Content */}
        {activeTab === 'details' && <DetailsTab po={po} colors={colors} />}
      </StackScreen>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        visible={showCancel}
        title="Cancel this purchase order?"
        message={`Cancel ${po.poNumber || po.id}? This stops further processing for this purchase order and cannot be undone.`}
        variant="danger"
        confirmLabel="Yes, cancel"
        cancelLabel="Keep order"
        onConfirm={handleCancel}
        onCancel={() => setShowCancel(false)}
        loading={actionLoading}
      />
      <ConfirmDialog
        visible={showArchive}
        title="Archive Purchase Order"
        message="This will archive the purchase order. It can be viewed later but no further actions can be taken."
        variant="warning"
        confirmLabel="Archive"
        onConfirm={handleArchive}
        onCancel={() => setShowArchive(false)}
        loading={actionLoading}
      />
      <ConfirmDialog
        visible={showDelete}
        title="Cancel Purchase Order"
        message="Are you sure you want to cancel this purchase order? This action cannot be undone."
        variant="danger"
        confirmLabel="Cancel PO"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        loading={actionLoading}
      />
    </>
  );
}

// ─── Details Tab ───
function DetailsTab({ po, colors }: { po: PurchaseOrder; colors: any }) {
  const fields = [
    { label: 'PO Number', value: po.poNumber || po.id, icon: 'finger-print-outline' },
    { label: 'Vendor', value: `${po.vendorNumber || String(po.vendorId || '').replace(/^V/i, '')} - ${po.companyName || po.vendorName || '-'}`, icon: 'business-outline' },
    { label: 'Material', value: `${po.materialNumber || String(po.materialId || '').replace(/^MAT/i, '')} - ${po.materialName || '-'}`, icon: 'cube-outline' },
    { label: 'Quantity', value: `${formatNumber(po.quantity || 0)} ${po.unit || 'units'}`, icon: 'scale-outline' },
   { label: 'Created At', value: po.createdAt ? formatEAT(po.createdAt) : '-', icon: 'time-outline' },
  ];

  return (
    <>
      <Card>
        {fields.map((field, i) => (
          <View key={i} style={styles.fieldRow}>
            <View style={styles.fieldLabel}>
              <Ionicons name={field.icon as any} size={16} color={colors.textMuted} />
              <Text style={[styles.fieldLabelText, { color: colors.textMuted }]}>{field.label}</Text>
            </View>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{field.value || '-'}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

// ─── Jobs Tab ───
function JobsTab({ poId, colors }: { poId: string; colors: any }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const { jobRepository } = require('../../../services/repositories/JobRepository');
      const all = await jobRepository.getAll();
      setJobs(all.filter((j: any) => j.purchaseOrderId === poId));
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSkeleton lines={3} variant="card" />;

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon="briefcase-outline"
        title="No jobs yet"
        subtitle="Jobs will appear here once created by quarry or site operators"
      />
    );
  }

  return (
    <>
      {jobs.map((job: any) => (
        <TouchableOpacity
          key={job.id}
          style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/operations/jobs/${job.id}` as any)}
        >
          <View style={styles.listCardHeader}>
            <View style={[styles.smallAvatar, { backgroundColor: colors.purple + '15' }]}>
              <Text style={[styles.smallAvatarText, { color: colors.purple }]}>J</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listCardTitle, { color: colors.text }]}>{job.jobId || job.id.slice(0, 8)}</Text>
              <Text style={[styles.listCardSub, { color: colors.textMuted }]}>
                {job.driverName || 'No driver'} - {job.plateNumber || 'No vehicle'}
              </Text>
              <Text style={[styles.listCardSub, { color: colors.textMuted }]}>
                {job.materialName} - {job.quantityDispatched || job.quantityOrdered} {job.unit}
              </Text>
            </View>
         
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}

// ─── Timeline Tab ───
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
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  poNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  poVendor: {
    fontSize: 14,
    marginTop: 2,
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
    fontSize: 12,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tabActions: {
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  fieldLabelText: {
    fontSize: 13,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingLeft: 4,
    paddingBottom: Spacing.md,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: Spacing.md,
  },
  timelineLine: {
    position: 'absolute',
    left: 9,
    top: 16,
    bottom: 0,
    width: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineTime: {
    fontSize: 12,
    marginTop: 2,
  },
  listCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  listCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  listCardSub: {
    fontSize: 12,
    marginTop: 1,
  },
});
