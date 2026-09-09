/**
 * Job Detail Screen - Full job information with status workflow
 *
 * Features:
 *   - Job overview with all details
 *   - Status timeline with timestamps
 *   - Status transition buttons (context-aware)
 *   - Weight information
 *   - Driver & vehicle info
 *   - Delivery and receipt document access when records are available
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
import { useLocalSearchParams } from 'expo-router';
import { router } from '../../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { jobRepository } from '../../../services/repositories/JobRepository';
import { Job } from '../../../store/types';
 import { JobDocuments } from '../../../components/JobDocuments';
import { normalizeJobStatus } from '../../../utils/jobStatus';
import { getSiteWeightFlagReason, isSiteWeightFlagged } from '../../../utils/siteFlags';

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
    const siteFlagged = isSiteWeightFlagged(job);
    return (
      <View>
        <Card style={siteFlagged ? { borderColor: colors.danger, borderWidth: 1.5 } : undefined}>
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
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Materials on PO</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{(Array.isArray((job as any).materials) && (job as any).materials.length ? (job as any).materials : [{ materialName: job.materialName, quantity: job.quantityDispatched || job.quantityOrdered, unit: job.unit }]).map((item: any) => `${item.materialName || 'Material'}${item.quantity != null ? ` (${item.quantity} ${item.unit || ''})` : ''}`).join('\n')}</Text>
          </View>
          {siteFlagged ? (
            <View style={[styles.detailRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#FECACA', paddingTop: Spacing.sm }]}>
              <Ionicons name="warning-outline" size={18} color={colors.danger} />
              <Text style={[styles.detailValue, { color: colors.danger, flex: 1, marginLeft: Spacing.sm }]}>
                {getSiteWeightFlagReason(job)}
              </Text>
            </View>
          ) : null}
        
        </Card>

        <Card style={{ marginTop: Spacing.xs}}>
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
        
        </Card>

        <JobDocuments
          job={job}
          showReceiptNote={['SITE_WEIGHED_OUT', 'COMPLETED'].includes(normalizeJobStatus(job.status))}
        />

       

      </View>
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
      <View style={[styles.backBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.backTitle, { color: colors.text }]}>Job Details</Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
      

      <View style={styles.detailsContent}>
        {renderOverview()}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
         alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  content: {
    padding: Spacing.lg,
    paddingTop:0,
    paddingBottom: Spacing['xl'],
  },
  header: { marginVertical: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  detailsContent: { marginVertical: Spacing.xs,
    gap: 2.5,
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
    fontSize: 14, marginTop: Spacing.xs,
  },
  delayedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md, marginTop: Spacing.xs,
  },
  delayedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700', marginBottom: Spacing.xs,
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
    borderRadius: Radius.md, marginTop: Spacing.xs,
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
    flexDirection: 'row', marginBottom: Spacing.xs,
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
    flex: 1, marginVertical: Spacing.xs,
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
    fontSize: 12, marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md, marginTop: Spacing.xs,
  },
});
