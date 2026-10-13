import { hasReceipt, receiptReference } from '../../utils/deliveryDocuments';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  DataCard,
  EmptyState,
  PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';
import { JobDocuments } from '../../components/JobDocuments';
import { Gap, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import {
  fetchCheckpoints,
  fetchDeliveryOrders,
  fetchDrivers,
  fetchPurchaseOrders,
  fetchVehicles,
} from '../../services/api';
import { formatEAT, formatStatus, generateReceiptNoteId, getStatusColor } from '../../utils/helpers';
import { normalizeJobStatus } from '../../utils/jobStatus';
import { getJobPurchaseOrderMaterials } from '../../utils/poMaterials';

type IconName = keyof typeof Ionicons.glyphMap;

const TIMELINE_LABELS: Record<string, { label: string; icon: IconName }> = {
  origin: { label: 'Job Created', icon: 'add-circle-outline' },
  weigh_in: { label: 'Quarry In Weight', icon: 'download-outline' },
  weigh_out: { label: 'Quarry Out Weight', icon: 'arrow-up-circle-outline' },
  arrived_site: { label: 'Arrived Site', icon: 'location-outline' },
  received: { label: 'Receipt Uploaded', icon: 'receipt-outline' },
};

function formatMaybeDate(value?: string) {
  return value ? formatEAT(value) : 'Pending';
}

function formatWeight(value?: number | string, unit = 't') {
  if (value === undefined || value === null || value === '') return 'Pending';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)} ${unit}` : String(value);
}

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const [job, setJob] = useState<any>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadJob = async () => {
      if (!id) {
        setLoading(false);
        setError('No job selected.');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const deliveries = await fetchDeliveryOrders({ jobId: id });
        const foundJob = deliveries.find((item: any) => item.jobId === id || item.id === id) || deliveries[0];

        if (!foundJob) {
          setError(`No job found for ${id}.`);
          setJob(null);
          return;
        }

        const [orders, drivers, vehicles, jobCheckpoints] = await Promise.all([
          fetchPurchaseOrders(),
          fetchDrivers(),
          fetchVehicles(),
          fetchCheckpoints({ jobId: foundJob.jobId }),
        ]);

        setJob(foundJob);
        setPurchaseOrder(
          orders.find((item: any) => foundJob.purchaseOrderId && item.id === foundJob.purchaseOrderId)
          || orders.find((item: any) => foundJob.poNumber && item.poNumber === foundJob.poNumber) || null
        );
        setDriver(drivers.find((item: any) => item.id === foundJob.driverId) || null);
        setVehicle(vehicles.find((item: any) => item.id === foundJob.vehicleId) || null);
        setCheckpoints(
          [...(jobCheckpoints || [])].sort(
            (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        );
      } catch (loadError) {
        setError('Failed to load job details.');
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [id]);

  const timelineCheckpoints = useMemo(() => checkpoints.filter((item) => item.type !== 'loading'), [checkpoints]);
  const isWeight = useMemo(() => timelineCheckpoints.some((item) => item.weight !== undefined && item.weight !== null), [timelineCheckpoints]);

  const isReceiptReady = hasReceipt(job);
  const orderMaterials = getJobPurchaseOrderMaterials(job, purchaseOrder ? [purchaseOrder] : []);
  const receiptNoteId = isReceiptReady ? receiptReference(job) || generateReceiptNoteId(job?.jobId || job?.id) : null;

  if (loading) {
    return (
      <PageShell>
        <DataCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primaryText} />
            <Text style={[styles.mutedStrong, { color: colors.textMuted }]}>Loading job hub...</Text>
          </View>
        </DataCard>
      </PageShell>
    );
  }

  if (error || !job) {
    return (
      <PageShell>
        <EmptyState
          icon="alert-circle-outline"
          title="Job not found"
          subtitle={error || 'This job could not be loaded.'}
        />
      </PageShell>
    );
  }

  return (
      <PageShell>
        <DataCard>
          <SectionTitle title={`Purchase order materials (${orderMaterials.length})`} />
          {orderMaterials.map((line, index) => (
            <View key={`${line.materialId || 'material'}-${index}`} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{index + 1}. {line.materialName || line.productName || 'Material'}</Text>
              {line.quantity != null || line.quantityOrdered != null ? <Text style={{ color: colors.textMuted, marginTop: 4 }}>Ordered: {line.quantity ?? line.quantityOrdered} {line.unit || ''}</Text> : null}
            </View>
          ))}
        </DataCard>
        {/* Dispatch Proof Photos from Quarry Weigh-Out */}
        {(job?.driverPhotoURL || job?.weighOutPhotoURL) ? (
          <DataCard>
            {job.driverPhotoURL ? (
              <View style={styles.photoSection}>
                <View style={styles.photoHeader}>
                  <Ionicons name="person-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.photoLabel, { color: colors.textMuted }]}>Driver Photo (Weigh-Out)</Text>
                </View>
                <Image source={{ uri: job.driverPhotoURL }} style={styles.photoImage} resizeMode="contain" />
              </View>
            ) : null}
            
          </DataCard>
        ) : null}

        <DataCard>
          {/* Receipt Note (RN) for completed jobs — tappable */}
        {receiptNoteId && (
          <TouchableOpacity
            style={[styles.rnBadge, { backgroundColor: '#10B98115', borderColor: '#10B98133' }]}
            onPress={() => router.push(`/screens/receipt-note?id=${encodeURIComponent(job.jobId || job.id)}` as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={16} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rnLabel, { color: colors.textMuted }]}>Receipt Note</Text>
              <Text style={[styles.rnValue, { color: colors.success }]} numberOfLines={3}>{receiptNoteId}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.success} />
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={() => router.push(`/screens/delivery-note?id=${job.jobId}` as any)}>
            <Ionicons name="receipt-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.primaryActionText}>Delivery note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => router.push(`/screens/purchase-order?id=${job.purchaseOrderId || job.poNumber}` as any)}>
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>Purchase order</Text>
          </TouchableOpacity>
        </View>
      </DataCard>

      {job.securityFlag?.status === 'cleared' ? (
        <DataCard style={styles.clearanceCard}>
          <View style={styles.clearanceHeader}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.purpleText} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.clearanceTitle, { color: colors.primaryText }]}>Security flag cleared</Text>
              <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Fleet unsuspended and eligible for site processing.</Text>
            </View>
          </View>
          <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Flagged by: {job.securityFlag.flaggedBy || 'Security'}</Text>
          <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Flagged at: {formatMaybeDate(job.securityFlag.flaggedAt)}</Text>
          <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Unsuspended by: {job.securityFlag.clearedBy || 'Administrator'}</Text>
          <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Unsuspended at: {formatMaybeDate(job.securityFlag.clearedAt)}</Text>
          {job.securityFlag.resolutionReason ? <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Clearance reason: {job.securityFlag.resolutionReason}</Text> : null}
        </DataCard>
      ) : null}

      {job.materialInspection?.mrfNumber ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => router.push(`/screens/material-inspection-report?id=${encodeURIComponent(job.jobId || job.id)}` as any)}
        >
          <DataCard style={styles.inspectionCard}>
            <View style={styles.clearanceHeader}>
              <Ionicons name="clipboard-outline" size={22} color={colors.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.inspectionTitle, { color: colors.primaryText }]}>Material inspection submitted</Text>
                <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>MIF #: {job.materialInspection.mrfNumber}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.tealText} />
            </View>
            <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Inspector: {job.materialInspection.inspectorName || 'Inspector'}</Text>
            <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Submitted: {formatMaybeDate(job.materialInspection.inspectedAt)}</Text>
            <Text style={[styles.clearanceText, { color: colors.textSecondary }]}>Result: {job.materialInspection.initialVisualInspection || 'Recorded'}</Text>
          </DataCard>
        </TouchableOpacity>
      ) : null}

      <JobDocuments job={job} showReceiptNote={isReceiptReady} />

      <SectionTitle title="Journey Timeline" />
      <DataCard>
        <TimelineItem
          icon="add-circle-outline"
          title="Job Created"
          meta={job?.isWarehouseDelivery || job?.deliveryOrigin === 'warehouse' ? `${formatMaybeDate(job?.createdAt)}\nFrom warehouse` : `${formatMaybeDate(job?.createdAt)}\nDriver: ${driver?.name || job?.driverName || 'Pending driver'}\nVehicle: ${vehicle?.plateNumber || vehicle?.plate || job?.plateNumber || 'Pending vehicle'}`}
          color={colors.primaryText}
          complete
        />
        {timelineCheckpoints.map((item) => {
          const config = TIMELINE_LABELS[item.type] || { label: formatStatus(item.type), icon: 'ellipse-outline' as IconName };
          return (
            <TimelineItem
              key={item.id}
              icon={config.icon}
              title={config.label}
              meta={isWeight ? `${formatWeight(item.weight)} at ${item.location} · ${formatMaybeDate(item.timestamp)}` : `${formatMaybeDate(item.timestamp)} - ${item.location}`}
              color={getStatusColor(item.type)}
              complete
            />
          );
        })}
        {job.receivedAt ? (
          <TimelineItem
            icon="checkmark-done-outline"
            title="Reconciliation Completed"
            meta={formatMaybeDate(job.receivedAt)}
            color={colors.success}
            complete
          />
        ) : null}
      </DataCard>

    </PageShell>
  );
}

function TimelineItem({
  icon,
  title,
  meta,
  color,
  complete,
}: {
  icon: IconName;
  title: string;
  meta: string;
  color: string;
  complete: boolean;
}) {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineIcon, { backgroundColor: complete ? `${color}18` : colors.inputBg }]}>
        <Ionicons name={icon} size={17} color={complete ? color : colors.textMuted} />
      </View>
      <View style={styles.timelineCopy}>
        <Text style={[styles.timelineTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.timelineMeta, { color: colors.textMuted }]}>{meta}</Text>
      </View>
    </View>
  );
}

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Gap},
  mutedStrong: { fontSize: 13, fontWeight: '800' },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', gap: Gap, alignItems: 'flex-start' },
  summaryCopy: { flex: 1 },
  summarySub: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs},
  priorityBadge: { borderRadius: 20, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  priorityText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', gap: Gap},
  primaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Gap,
  },
  primaryActionText: { color: colors.onPrimary, fontSize: 13, fontWeight: '900' },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Gap,
  },
  secondaryActionText: { fontSize: 13, fontWeight: '900' },
  rnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap,
    borderRadius: 8,
    borderWidth: 1,
    padding: Spacing.md, marginTop: Spacing.xs,
  },
  rnLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs},
  rnValue: { fontSize: 15, fontWeight: '900' },
  timelineItem: { flexDirection: 'row', gap: Gap, alignItems: 'flex-start' },
  timelineIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  timelineCopy: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '900' },
  timelineMeta: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs, lineHeight: 17 },
  // Dispatch photo section
  photoSection: { marginBottom: Spacing.xs},
  photoHeader: { flexDirection: 'row', alignItems: 'center', gap: Gap, marginBottom: Spacing.xs},
  photoLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  photoImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: colors.surface },
  clearanceCard: { borderColor: '#A78BFA', borderWidth: 1.5 },
  clearanceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Gap},
  clearanceTitle: { color: '#6D28D9', fontSize: 16, fontWeight: '800' },
  clearanceText: { fontSize: 12, lineHeight: 18 },
  inspectionCard: { borderColor: '#5EEAD4', borderWidth: 1.5 },
  inspectionTitle: { color: colors.tealText, fontSize: 16, fontWeight: '800' },
});
