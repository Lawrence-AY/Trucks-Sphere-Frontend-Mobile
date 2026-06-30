import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  ProgressBar,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import {
  fetchCheckpoints,
  fetchDeliveryOrders,
  fetchDrivers,
  fetchPurchaseOrders,
  fetchVehicles,
  fetchWeighments,
} from '../../services/api';
import { formatEAT, formatStatus, getStatusColor } from '../../utils/helpers';

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

function formatJobCreatedMeta(job: any, driver: any, vehicle: any) {
  const driverName = driver?.name || job?.driverName || 'Pending driver';
  const plateNumber = vehicle?.plateNumber || vehicle?.plate || job?.plateNumber || 'Pending vehicle';
  return `${formatMaybeDate(job?.createdAt)}\nDriver: ${driverName}\nVehicle: ${plateNumber}`;
}

function progressForJob(job: any, checkpoints: any[]) {
  if (!job) return 0;
  if (job.status === 'delivered' || job.status === 'completed') return 100;
  if (job.receivedAt || checkpoints.some((item) => item.type === 'received')) return 92;
  if (job.weighOutWeight || checkpoints.some((item) => item.type === 'weigh_out')) return 62;
  if (job.weighInWeight || checkpoints.some((item) => item.type === 'weigh_in')) return 34;
  if (job.driverId || job.vehicleId) return 18;
  return 8;
}

const CHECKPOINT_CONFIG: Record<string, { label: string; icon: IconName }> = {
  weigh_in: { label: 'Weigh In', icon: 'download-outline' },
  weigh_out: { label: 'Weigh Out', icon: 'arrow-up-circle-outline' },
  loading: { label: 'Loading', icon: 'cube-outline' },
  arrived_site: { label: 'Arrived at Site', icon: 'location-outline' },
  received: { label: 'Received', icon: 'receipt-outline' },
};

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [job, setJob] = useState<any>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [weighments, setWeighments] = useState<any[]>([]);
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

        const [orders, drivers, vehicles, jobWeighments, jobCheckpoints] = await Promise.all([
          fetchPurchaseOrders(),
          fetchDrivers(),
          fetchVehicles(),
          fetchWeighments({ jobId: foundJob.jobId }),
          fetchCheckpoints({ jobId: foundJob.jobId }),
        ]);

        setJob(foundJob);
        setPurchaseOrder(
          orders.find((item: any) => item.id === foundJob.purchaseOrderId || item.poNumber === foundJob.poNumber) || null
        );
        setDriver(drivers.find((item: any) => item.id === foundJob.driverId) || null);
        setVehicle(vehicles.find((item: any) => item.id === foundJob.vehicleId) || null);
        setWeighments(jobWeighments || []);
        setCheckpoints(
          [...(jobCheckpoints || [])].sort(
            (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        );
      } catch (loadError) {
        console.error('Job details load error:', loadError);
        setError('Failed to load job details.');
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [id]);

  const progress = useMemo(() => progressForJob(job, checkpoints), [checkpoints, job]);
  const timelineCheckpoints = useMemo(() => checkpoints.filter((item) => item.type !== 'loading'), [checkpoints]);
  const isWeight = useMemo(() => timelineCheckpoints.some((item) => item.weight !== undefined && item.weight !== null), [timelineCheckpoints]);
  const orderedQty = Number(job?.quantityOrdered || job?.quantity || 0);
  const deliveredQty = Number(job?.quantityDelivered || job?.netWeight || 0);
  const expectedNet = job?.netWeight || (job?.weighInWeight && job?.weighOutWeight ? job.weighInWeight - job.weighOutWeight : 0);
  const siteVariance = deliveredQty && expectedNet ? deliveredQty - expectedNet : 0;
  const varianceTone = Math.abs(siteVariance) > 1 ? colors.danger : colors.success;
  const unit = purchaseOrder?.unit || 'tonnes';

  if (loading) {
    return (
      <PageShell>
        <DataCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
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
      <CommandHeader
        eyebrow={job.poNumber || purchaseOrder?.poNumber || 'Job operations'}
        title={job.jobId}
        subtitle={`${job.materialName || purchaseOrder?.materialName || 'Material'} to ${job.siteName || 'Destination'}`}
        right={<StatusPill status={job.status} compact />}
      />

      <DataCard>
        <View style={styles.summaryHead}>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summarySub, { color: colors.textMuted }]}>
              {`${job.quarryName || 'Origin'} to ${job.siteName || 'Destination'}`}
            </Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: `${getStatusColor(job.status)}18` }]}>
            <Text style={[styles.priorityText, { color: getStatusColor(job.status) }]}>{formatStatus(job.status)}</Text>
          </View>
        </View>
        <ProgressBar value={progress} color={job.status === 'delivered' ? colors.success : colors.primary} />
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={() => router.push(`/screens/delivery-note?id=${job.jobId}`)}>
            <Ionicons name="receipt-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Delivery note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => router.push(`/screens/purchase-order?id=${job.purchaseOrderId || job.poNumber}`)}>
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>Purchase order</Text>
          </TouchableOpacity>
        </View>
      </DataCard>

     
     

      <SectionTitle title="Journey Timeline" />
      <DataCard>
        <TimelineItem
          icon="add-circle-outline"
          title="Job Created"
          meta={formatJobCreatedMeta(job, driver, vehicle)}
          color={colors.primary}
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


      <SectionTitle title="Activity Log" />
      <DataCard>
        <DetailRow icon="create-outline" value={`Created by ${job.createdBy || 'system'} on ${formatMaybeDate(job.createdAt)}`} />
        <DetailRow icon="sync-outline" value={`Last updated ${formatMaybeDate(job.updatedAt)}`} />
        <DetailRow icon="flag-outline" value={`Current status: ${formatStatus(job.status)}`} />
      </DataCard>
    </PageShell>
  );
}

function HubRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const colors = useTheme();
  return (
    <View style={styles.hubRow}>
      <View style={[styles.hubIcon, { backgroundColor: colors.inputBg }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.hubCopy}>
        <Text style={[styles.hubLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.hubValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function WeightCell({ label, value }: { label: string; value: string }) {
  const colors = useTheme();
  return (
    <View style={[styles.weightCell, { backgroundColor: colors.inputBg }]}>
      <Text style={[styles.weightLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.weightValue, { color: colors.text }]}>{value}</Text>
    </View>
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

const styles = StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  mutedStrong: { fontSize: 13, fontWeight: '800' },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, alignItems: 'flex-start' },
  summaryCopy: { flex: 1 },
  summarySub: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  priorityBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  priorityText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryActionText: { fontSize: 13, fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  hubRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  hubIcon: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  hubCopy: { flex: 1 },
  hubLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  hubValue: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  weightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  weightCell: { width: '48%', minHeight: 76, borderRadius: Radius.md, padding: Spacing.md, justifyContent: 'space-between' },
  weightLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  weightValue: { fontSize: 16, fontWeight: '900' },
  reconciliationBand: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reconciliationText: { flex: 1, fontSize: 13, fontWeight: '900' },
  timelineItem: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  timelineIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  timelineCopy: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '900' },
  timelineMeta: { fontSize: 12, fontWeight: '700', marginTop: 3, lineHeight: 17 },
});