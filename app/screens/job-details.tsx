import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Clipboard, Modal, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';
import { Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import {
  fetchCheckpoints,
  fetchDeliveryOrders,
  fetchDrivers,
  fetchPurchaseOrders,
  fetchVehicles,
} from '../../services/api';
import { formatEAT, formatStatus, generateReceiptNoteId, getStatusColor } from '../../utils/helpers';

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

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
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
          orders.find((item: any) => item.id === foundJob.purchaseOrderId || item.poNumber === foundJob.poNumber) || null
        );
        setDriver(drivers.find((item: any) => item.id === foundJob.driverId) || null);
        setVehicle(vehicles.find((item: any) => item.id === foundJob.vehicleId) || null);
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

  const timelineCheckpoints = useMemo(() => checkpoints.filter((item) => item.type !== 'loading'), [checkpoints]);
  const isWeight = useMemo(() => timelineCheckpoints.some((item) => item.weight !== undefined && item.weight !== null), [timelineCheckpoints]);

  const isCompleted = job?.status === 'completed' || job?.status === 'delivered';
  const receiptNoteId = isCompleted && job?.jobId ? (job.receiptNoteId || generateReceiptNoteId(job.jobId)) : null;
  const isTrackingActive = job?.trackingId && ['loaded', 'dispatched', 'in_transit', 'en_route'].includes(job?.status);
  const trackingUrl = isTrackingActive ? `/track/${job.trackingId}` : null;

  // Full shareable public URL (matches Expo web origin)
  const fullTrackingUrl = useMemo(() => {
    if (!isTrackingActive || !job?.trackingId) return null;
    // In Expo web, use the current origin (localhost:8081) + the tracking path
    return `http://localhost:8081/track/${job.trackingId}`;
  }, [isTrackingActive, job?.trackingId]);

  const handleCopyTrackingLink = () => {
    if (fullTrackingUrl) {
      Clipboard.setString(fullTrackingUrl);
      Alert.alert('Copied!', 'Tracking link copied to clipboard.');
    }
  };

  const handleShareTrackingLink = async () => {
    if (fullTrackingUrl) {
      setTrackingMenuVisible(false);
      await Share.share({
        message: `Track this delivery: ${fullTrackingUrl}`,
        title: `TruckSphere Tracking - ${job.trackingId}`,
      });
    }
  };

  const [trackingMenuVisible, setTrackingMenuVisible] = useState(false);

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
    

      <DataCard>
         

        {/* Tracking ID — Clean badge + popover for sharing actions */}
        {isTrackingActive && job?.trackingId ? (
          <>
            <TouchableOpacity
              style={[styles.trackingRow, { backgroundColor: '#2563EB08', borderColor: '#2563EB22' }]}
              onPress={() => setTrackingMenuVisible(true)}
              activeOpacity={0.6}
            >
              <View style={[styles.trackingLiveDot, { backgroundColor: '#10B981' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rnLabel, { color: colors.textMuted, marginBottom: 1 }]}>
                  Public Tracking <Text style={{ color: '#10B981', fontWeight: '800' }}>● LIVE</Text>
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.trackingIdText, { color: '#2563EB' }]} selectable>
                    {job.trackingId}
                  </Text>
                  <Ionicons name="share-outline" size={13} color="#2563EB" />
                </View>
              </View>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* ─── Popover Menu ─── */}
            <Modal
              visible={trackingMenuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setTrackingMenuVisible(false)}
            >
              <Pressable
                style={styles.popoverBackdrop}
                onPress={() => setTrackingMenuVisible(false)}
              >
                <View style={[styles.popoverSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {/* Header */}
                  <View style={styles.popoverHeader}>
                    <Ionicons name="radio-outline" size={20} color="#2563EB" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.popoverTitle, { color: colors.text }]}>Public Tracking</Text>
                      <Text style={[styles.popoverSub, { color: colors.textMuted }]}>
                        {job.trackingId}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setTrackingMenuVisible(false)}>
                      <Ionicons name="close" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  {/* Live Status Preview */}
                  <View style={[styles.popoverStatus, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <View style={styles.popoverStatusRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={[styles.popoverStatusText, { color: '#065F46' }]}>In Transit</Text>
                    </View>
                    <View style={styles.popoverStatusRow}>
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text style={[styles.popoverStatusText, { color: '#374151' }]}>
                        Dispatched: {formatEAT(job.weighOutAt)}
                      </Text>
                    </View>
                    <View style={styles.popoverStatusRow}>
                      <Ionicons name="bus-outline" size={14} color="#6B7280" />
                      <Text style={[styles.popoverStatusText, { color: '#374151' }]}>
                        {job.driverName || '—'} · {job.plateNumber || '—'}
                      </Text>
                    </View>
                    <View style={styles.popoverStatusRow}>
                      <Ionicons name="cube-outline" size={14} color="#6B7280" />
                      <Text style={[styles.popoverStatusText, { color: '#374151' }]}>
                        {job.materialName || '—'}
                        {job.netWeight != null ? ` · ${job.netWeight.toFixed(1)}T` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={[styles.popoverDivider, { backgroundColor: colors.border }]} />

                  {/* Action: View Tracking Page */}
                  <TouchableOpacity
                    style={[styles.popoverAction, { borderColor: colors.border }]}
                    onPress={() => { setTrackingMenuVisible(false); router.push(trackingUrl as any); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="open-outline" size={18} color={colors.primary} />
                    <Text style={[styles.popoverActionText, { color: colors.text }]}>View Tracking Page</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>

                  {/* Action: Copy URL */}
                  <TouchableOpacity
                    style={[styles.popoverAction, { borderColor: colors.border }]}
                    onPress={() => { setTrackingMenuVisible(false); setTimeout(handleCopyTrackingLink, 200); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.popoverActionText, { color: colors.text }]}>Copy URL</Text>
                    <Text style={[styles.popoverActionHint, { color: colors.textTertiary }]} numberOfLines={1}>
                      {fullTrackingUrl}
                    </Text>
                  </TouchableOpacity>

                  {/* Action: Share URL */}
                  <TouchableOpacity
                    style={[styles.popoverAction, { borderColor: colors.border }]}
                    onPress={handleShareTrackingLink}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.popoverActionText, { color: colors.text }]}>Share URL</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Modal>
          </>
        ) : null}

        {/* Tracking ID (inactive) — show ID but no link */}
        {job?.trackingId && !isTrackingActive ? (
          <View style={[styles.trackingBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="radio-outline" size={16} color={colors.textTertiary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rnLabel, { color: colors.textMuted }]}>Tracking ID (Expired)</Text>
              <Text style={[styles.rnValue, { color: colors.textTertiary }]} numberOfLines={3} selectable>
                {job.trackingId}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Receipt Note (RN) for completed jobs — tappable */}
        {receiptNoteId && (
          <TouchableOpacity
            style={[styles.rnBadge, { backgroundColor: '#10B98115', borderColor: '#10B98133' }]}
            onPress={() => router.push(`/screens/receipt-note?id=${job.jobId}` as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={16} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rnLabel, { color: colors.textMuted }]}>Receipt Note</Text>
              <Text style={[styles.rnValue, { color: '#10B981' }]} numberOfLines={3}>{receiptNoteId}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#10B981" />
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={() => router.push(`/screens/delivery-note?id=${job.jobId}` as any)}>
            <Ionicons name="receipt-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Delivery note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => router.push(`/screens/purchase-order?id=${job.purchaseOrderId || job.poNumber}` as any)}>
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
              meta={`${formatMaybeDate(job?.createdAt)}\nDriver: ${driver?.name || job?.driverName || 'Pending driver'}\nVehicle: ${vehicle?.plateNumber || vehicle?.plate || job?.plateNumber || 'Pending vehicle'}`}
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
  priorityBadge: { borderRadius: 20, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  priorityText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryActionText: { fontSize: 13, fontWeight: '900' },
  /* ─── Tracking Row (collapsed badge) ─── */
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  trackingLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trackingIdText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  /* ─── Inactive/Expired badge ─── */
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  rnLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  rnValue: { fontSize: 15, fontWeight: '900' },
  /* ─── Popover ─── */
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  popoverSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  popoverTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  popoverSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  popoverStatus: {
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 6,
  },
  popoverStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  popoverStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  popoverDivider: {
    height: 1,
  },
  popoverAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  popoverActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  popoverActionHint: {
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 140,
  },
  /* ─── Legacy (kept for compatibility) ─── */
  trackingUrl: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  trackingActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  trackingActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  trackingActionText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  timelineItem: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  timelineIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  timelineCopy: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '900' },
  timelineMeta: { fontSize: 12, fontWeight: '700', marginTop: 3, lineHeight: 17 },
});