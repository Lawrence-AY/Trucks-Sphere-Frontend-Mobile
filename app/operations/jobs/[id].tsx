/**
 * Job Detail Screen - Full job information with status workflow
 *
 * Features:
 *   - Job overview with all details
 *   - Status timeline with timestamps
 *   - Status transition buttons (context-aware)
 *   - Weight information
 *   - Driver & vehicle info
 *   - Receipt upload placeholder
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
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
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { jobRepository } from '../../../services/repositories/JobRepository';
import { Job } from '../../../store/types';

const JOB_TABS = [
  { name: 'overview', label: 'Overview', icon: 'information-circle-outline' as const },
  { name: 'timeline', label: 'Timeline', icon: 'time-outline' as const },
  { name: 'weights', label: 'Weights', icon: 'scale-outline' as const },
];

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['assigned'],
  assigned: ['ready'],
  ready: ['loading'],
  loading: ['quarry_in'],
  quarry_in: ['quarry_out'],
  quarry_out: ['in_transit'],
  in_transit: ['site_in'],
  site_in: ['offloading'],
  offloading: ['site_out'],
  site_out: ['receipt_uploaded'],
  receipt_uploaded: ['reconciliation'],
  reconciliation: ['completed'],
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) loadJob();
  }, [id]);

  async function loadJob() {
    try {
      const j = await jobRepository.getById(id!);
      setJob(j);
    } catch {
      Alert.alert('Error', 'Failed to load job');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    jobRepository.invalidateCache();
    await loadJob();
    setRefreshing(false);
  }

  function getStatusVariant(status?: string): 'success' | 'warning' | 'danger' | 'default' | 'info' {
    switch (status) {
      case 'completed': return 'success';
      case 'in_transit':
      case 'quarry_out':
      case 'site_out': return 'info';
      case 'loading':
      case 'offloading': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'default';
    }
  }

  function getNextStatuses(): string[] {
    if (!job) return [];
    return STATUS_TRANSITIONS[job.status] || [];
  }

  async function handleStatusTransition(nextStatus: string) {
    if (!job) return;
    setUpdating(true);
    try {
      const updates: Partial<Job> = { status: nextStatus as any };

      // Record timestamps based on status
      const now = new Date().toISOString();
      switch (nextStatus) {
        case 'loading': updates.dispatchTime = now; break;
        case 'quarry_in': updates.quarryInTime = now; break;
        case 'quarry_out': updates.quarryOutTime = now; break;
        case 'site_in': updates.siteInTime = now; break;
        case 'site_out': updates.siteOutTime = now; break;
        case 'receipt_uploaded': updates.receiptTime = now; break;
        case 'completed': updates.completionTime = now; break;
      }

      await jobRepository.update(job.id, updates);
      await loadJob();
      Alert.alert('Updated', `Job status changed to ${nextStatus.replace('_', ' ')}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update job');
    } finally {
      setUpdating(false);
    }
  }

  function renderOverview() {
    if (!job) return null;
    return (
      <View>
        <Card>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Job ID</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{job.jobId || job.id.slice(0, 8)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>PO Number</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{job.poNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Vendor</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{job.vendorName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Material</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{job.materialName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Quantity</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {job.quantityDispatched || job.quantityOrdered} {job.unit}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status</Text>
            <Badge label={job.status?.replace('_', ' ') || 'unknown'} variant={getStatusVariant(job.status)} dot />
          </View>
        </Card>

        <Card style={{ marginTop: Spacing.md }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Assignment</Text>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.detailValue, { color: colors.text, marginLeft: Spacing.sm }]}>
              {job.driverName || 'Unassigned'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="car-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.detailValue, { color: colors.text, marginLeft: Spacing.sm }]}>
              {job.plateNumber || 'Unassigned'}
            </Text>
          </View>
          {job.quarryName && (
            <View style={styles.detailRow}>
              <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.detailValue, { color: colors.text, marginLeft: Spacing.sm }]}>
                {job.quarryName}
              </Text>
            </View>
          )}
          {job.siteName && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.detailValue, { color: colors.text, marginLeft: Spacing.sm }]}>
                {job.siteName}
              </Text>
            </View>
          )}
        </Card>

        {/* Status Transition Buttons */}
        {getNextStatuses().length > 0 && (
          <Card style={{ marginTop: Spacing.md }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
            <View style={styles.transitionButtons}>
              {getNextStatuses().map((nextStatus) => (
                <Button
                  key={nextStatus}
                  title={`Mark ${nextStatus.replace('_', ' ')}`}
                  onPress={() => handleStatusTransition(nextStatus)}
                  icon="arrow-forward-circle-outline"
                  size="sm"
                  loading={updating}
                />
              ))}
            </View>
          </Card>
        )}
      </View>
    );
  }

  function renderTimeline() {
    if (!job) return null;
    const timelineItems = [
      { label: 'Created', time: job.createdAt, icon: 'add-circle-outline' as const },
      { label: 'Dispatch', time: job.dispatchTime, icon: 'time-outline' as const },
      { label: 'Quarry In', time: job.quarryInTime, icon: 'enter-outline' as const },
      { label: 'Quarry Out', time: job.quarryOutTime, icon: 'exit-outline' as const },
      { label: 'Site In', time: job.siteInTime, icon: 'enter-outline' as const },
      { label: 'Site Out', time: job.siteOutTime, icon: 'exit-outline' as const },
      { label: 'Receipt', time: job.receiptTime, icon: 'document-outline' as const },
      { label: 'Completed', time: job.completionTime, icon: 'checkmark-circle-outline' as const },
    ];

    return (
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Job Timeline</Text>
        {timelineItems.map((item, index) => {
          const isComplete = !!item.time;
          return (
            <View key={item.label} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: isComplete ? colors.success : colors.border }]}>
                  <Ionicons
                    name={item.icon}
                    size={14}
                    color={isComplete ? '#fff' : colors.textMuted}
                  />
                </View>
                {index < timelineItems.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: isComplete ? colors.success : colors.border }]} />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineLabel, { color: isComplete ? colors.text : colors.textMuted }]}>
                  {item.label}
                </Text>
                {item.time && (
                  <Text style={[styles.timelineTime, { color: colors.textMuted }]}>
                    {new Date(item.time).toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </Card>
    );
  }

  function renderWeights() {
    if (!job) return null;
    return (
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Weight Records</Text>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Weigh In</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {job.weighInWeight ? `${job.weighInWeight} kg` : 'Not recorded'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Weigh Out</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {job.weighOutWeight ? `${job.weighOutWeight} kg` : 'Not recorded'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Net Weight</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {job.netWeight ? `${job.netWeight} kg` : 'Not calculated'}
          </Text>
        </View>
        {job.weightVariance !== undefined && (
          <View style={[styles.alert, { backgroundColor: (job.weightVariance > 0 ? colors.warning : colors.success) + '15' }]}>
            <Ionicons
              name={job.weightVariance > 0 ? 'alert-circle' : 'checkmark-circle'}
              size={16}
              color={job.weightVariance > 0 ? colors.warning : colors.success}
            />
            <Text style={[styles.alertText, { color: job.weightVariance > 0 ? colors.warning : colors.success }]}>
              Variance: {job.weightVariance > 0 ? '+' : ''}{job.weightVariance} kg
            </Text>
          </View>
        )}
      </Card>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSkeleton lines={10} variant="card" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Job not found</Text>
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
        <Text style={styles.backTitle}>Job Details</Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="cube-outline" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {job.jobId || `Job ${job.id.slice(0, 8)}`}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {job.materialName} - {job.vendorName}
            </Text>
          </View>
          <Badge label={job.status?.replace('_', ' ') || 'unknown'} variant={getStatusVariant(job.status)} dot />
        </View>
        {job.isDelayed && (
          <View style={[styles.delayedBanner, { backgroundColor: colors.danger + '15' }]}>
            <Ionicons name="time-outline" size={16} color={colors.danger} />
            <Text style={[styles.delayedText, { color: colors.danger }]}>Delayed Delivery</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <Tabs
        tabs={JOB_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      <View style={{ marginTop: Spacing.md }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'timeline' && renderTimeline()}
        {activeTab === 'weights' && renderWeights()}
      </View>

      {/* Back Button */}
      <View style={styles.actions}>
        <Button
          title="Back to Operations"
          onPress={() => router.back()}
          variant="ghost"
          style={{ flex: 1 }}
        />
      </View>
    </ScrollView>
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
    paddingBottom: Spacing.sm,
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: Spacing.sm,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  delayedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  delayedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  alertText: {
    fontSize: 13,
    flex: 1,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  transitionButtons: {
    gap: Spacing.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 32,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.md,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineTime: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
