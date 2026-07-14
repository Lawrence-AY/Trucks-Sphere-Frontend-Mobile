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
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const PO_TABS = [
  { name: 'details', label: 'Details', icon: 'information-circle-outline' as const },
  { name: 'jobs', label: 'Jobs', icon: 'briefcase-outline' as const },
  { name: 'timeline', label: 'Timeline', icon: 'time-outline' as const },
];

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; label: string }> = {
  draft: { variant: 'default', label: 'Draft' },
  approved: { variant: 'info', label: 'Approved' },
  in_progress: { variant: 'purple', label: 'In Progress' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  archived: { variant: 'default', label: 'Archived' },
};

export default function PurchaseOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [actionLoading, setActionLoading] = useState(false);

  // Confirm dialogs
  const [showApprove, setShowApprove] = useState(false);
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

  function getStatusBadge(status?: string) {
    const config = STATUS_BADGE[status || ''] || { variant: 'default' as any, label: status || 'Unknown' };
    return <Badge label={config.label} variant={config.variant} size="md" dot />;
  }

  function getProgress(): number {
    if (!po?.quantity) return 0;
    const delivered = po.quantityDelivered || po.deliveredQuantity || 0;
    return Math.min(100, Math.round((delivered / po.quantity) * 100));
  }

  // ─── Workflow Actions ───

  async function handleApprove() {
    setActionLoading(true);
    try {
      await purchaseOrderRepository.approve(id!, 'current_user');
      Alert.alert('Approved', 'Purchase order has been approved');
      loadPO();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
      setShowApprove(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await purchaseOrderRepository.cancel(id!);
      Alert.alert('Cancelled', 'Purchase order has been cancelled');
      loadPO();
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
    if (!po) return null;
    const status = po.status;

    return (
      <View style={styles.actionsRow}>
        {status === 'draft' && (
          <>
            <Button
              title="Approve"
              onPress={() => setShowApprove(true)}
              variant="success"
              size="sm"
              icon="checkmark-circle"
            />
            <Button
              title="Edit"
              onPress={() => router.push(`/management/purchase-orders/edit/${po.id}` as any)}
              variant="secondary"
              size="sm"
              icon="create-outline"
            />
            <Button
              title="Cancel"
              onPress={() => setShowCancel(true)}
              variant="danger"
              size="sm"
              icon="close-circle"
            />
          </>
        )}
        {status === 'approved' && (
          <>
            <Button
              title="Cancel PO"
              onPress={() => setShowCancel(true)}
              variant="danger"
              size="sm"
              icon="close-circle"
            />
          </>
        )}
        {status === 'in_progress' && (
          <Button
            title="Cancel PO"
            onPress={() => setShowCancel(true)}
            variant="danger"
            size="sm"
            icon="close-circle"
          />
        )}
        {status === 'completed' && (
          <Button
            title="Archive"
            onPress={() => setShowArchive(true)}
            variant="secondary"
            size="sm"
            icon="archive-outline"
          />
        )}
        {['draft', 'cancelled', 'archived'].includes(status) && (
          <Button
            title="Cancel PO"
            onPress={() => setShowDelete(true)}
            variant="danger"
            size="sm"
            icon="close-circle"
          />
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSkeleton lines={8} variant="card" />
      </View>
    );
  }

  if (!po) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" title="Purchase order not found" />
      </View>
    );
  }

  const progress = getProgress();
  const delivered = po.quantityDelivered || po.deliveredQuantity || 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Purchase Order</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.poNumber, { color: colors.text }]}>
                {po.poNumber || po.id}
              </Text>
              <Text style={[styles.poVendor, { color: colors.textMuted }]}>
                {po.vendorName || 'Unknown Vendor'}
              </Text>
            </View>
            {getStatusBadge(po.status)}
          </View>

          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                {formatNumber(delivered)} / {formatNumber(po.quantity || 0)} {po.unit || 'units'} delivered
              </Text>
              <Text style={[styles.progressPercent, { color: colors.primary }]}>{progress}%</Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.inputBg }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: progress >= 100 ? colors.success : colors.primary,
                    width: `${progress}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Actions */}
          {renderActions()}
        </View>

        {/* Tabs */}
        <Tabs tabs={PO_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === 'details' && <DetailsTab po={po} colors={colors} />}
        {activeTab === 'jobs' && <JobsTab poId={po.id} colors={colors} />}
        {activeTab === 'timeline' && <TimelineTab po={po} colors={colors} />}
      </ScrollView>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        visible={showApprove}
        title="Approve Purchase Order"
        message="Are you sure you want to approve this purchase order?"
        variant="info"
        confirmLabel="Approve"
        onConfirm={handleApprove}
        onCancel={() => setShowApprove(false)}
        loading={actionLoading}
      />
      <ConfirmDialog
        visible={showCancel}
        title="Cancel Purchase Order"
        message="Are you sure you want to cancel this purchase order? This action cannot be undone."
        variant="danger"
        confirmLabel="Cancel PO"
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
    </View>
  );
}

// ─── Details Tab ───
function DetailsTab({ po, colors }: { po: PurchaseOrder; colors: any }) {
  const fields = [
    { label: 'PO Number', value: po.poNumber || po.id, icon: 'finger-print-outline' },
    { label: 'Vendor', value: po.vendorName, icon: 'business-outline' },
    { label: 'Material', value: po.materialName, icon: 'cube-outline' },
    { label: 'Quantity', value: `${formatNumber(po.quantity || 0)} ${po.unit || 'units'}`, icon: 'scale-outline' },
    { label: 'Delivered', value: formatNumber(po.quantityDelivered || po.deliveredQuantity || 0), icon: 'checkmark-circle-outline' },
    { label: 'Remaining', value: formatNumber(po.remainingQuantity || Math.max(0, (po.quantity || 0) - (po.quantityDelivered || po.deliveredQuantity || 0))), icon: 'hourglass-outline' },
    { label: 'Expected Completion', value: po.expectedCompletion ? formatEAT(po.expectedCompletion) : '-', icon: 'calendar-outline' },
    { label: 'Created By', value: po.createdBy || '-', icon: 'person-outline' },
    { label: 'Created At', value: po.createdAt ? formatEAT(po.createdAt) : '-', icon: 'time-outline' },
    { label: 'Notes', value: po.notes || '-', icon: 'document-text-outline' },
  ];

  return (
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
            <Badge label={job.status?.replace('_', ' ') || 'unknown'} variant="default" size="sm" />
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}

// ─── Timeline Tab ───
function TimelineTab({ po, colors }: { po: PurchaseOrder; colors: any }) {
  const events = [
    { label: 'Purchase Order Created', time: po.createdAt, icon: 'add-circle-outline', color: colors.primary },
    { label: 'Status: Draft', time: po.createdAt, icon: 'document-outline', color: colors.textMuted },
  ];

  if (po.approvedAt) {
    events.push({ label: 'Purchase Order Approved', time: po.approvedAt, icon: 'checkmark-circle-outline', color: colors.success });
  }

  return (
    <Card>
      {events.map((event, i) => (
        <View key={i} style={styles.timelineItem}>
          <View style={[styles.timelineDot, { backgroundColor: event.color }]} />
          {i < events.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
          <View style={styles.timelineContent}>
            <Text style={[styles.timelineLabel, { color: colors.text }]}>{event.label}</Text>
            <Text style={[styles.timelineTime, { color: colors.textMuted }]}>
              {event.time ? formatEAT(event.time) : '-'}
            </Text>
          </View>
        </View>
      ))}
    </Card>
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
