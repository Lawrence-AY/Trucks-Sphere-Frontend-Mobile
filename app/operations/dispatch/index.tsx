/**
 * Dispatch Screen - Quick dispatch workflow for Quarry Operators
 *
 * Features:
 *   - View jobs ready for dispatch
 *   - Assign driver and vehicle
 *   - Record dispatch weight
 *   - Start journey
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { jobRepository } from '../../../services/repositories/JobRepository';
import { Job } from '../../../store/types';

const DISPATCHABLE_STATUSES = ['draft', 'assigned', 'ready', 'loading'];

export default function DispatchScreen() {
  const colors = useTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const data = await jobRepository.getAll();
      setJobs(data.filter((j) => DISPATCHABLE_STATUSES.includes(j.status)));
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    jobRepository.invalidateCache();
    await loadJobs();
    setRefreshing(false);
  }

  async function handleQuickDispatch(job: Job) {
    try {
      await jobRepository.update(job.id, {
        status: 'loading',
        dispatchTime: new Date().toISOString(),
      });
      Alert.alert('Dispatched', `Job ${job.jobId || job.id.slice(0, 8)} has been dispatched`);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to dispatch');
    }
  }

  function renderJob({ item }: { item: Job }) {
    return (
      <TouchableOpacity
        style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/operations/jobs/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.jobHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId || item.id.slice(0, 8)}</Text>
            <Text style={[styles.jobPO, { color: colors.textMuted }]}>PO: {item.poNumber}</Text>
          </View>
          <Badge label={item.status?.replace('_', ' ') || 'unknown'} variant="warning" size="sm" dot />
        </View>

        <View style={styles.jobDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="business-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.detailText, { color: colors.text }]}>{item.vendorName}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cube-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.detailText, { color: colors.text }]}>
              {item.materialName} - {item.quantityDispatched || item.quantityOrdered} {item.unit}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="person-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.detailText, { color: colors.text }]}>{item.driverName || 'Unassigned'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="car-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.detailText, { color: colors.text }]}>{item.plateNumber || 'Unassigned'}</Text>
          </View>
        </View>

        <View style={styles.jobActions}>
          <Button
            title="Dispatch Now"
            onPress={() => handleQuickDispatch(item)}
            icon="arrow-forward-circle"
            size="sm"
            style={{ flex: 1 }}
          />
          <Button
            title="Details"
            onPress={() => router.push(`/operations/jobs/${item.id}` as any)}
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
          />
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Dispatch</Text>
        </View>
        <LoadingSkeleton lines={5} variant="card" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Dispatch</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {jobs.length} job{jobs.length !== 1 ? 's' : ''} ready for dispatch
            </Text>
          </View>
          <Button
            title="New Job"
            onPress={() => router.push('/operations/jobs/create' as any)}
            icon="add-circle-outline"
            size="sm"
          />
        </View>
      </View>

      {jobs.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="No jobs to dispatch"
          subtitle="All jobs have been dispatched or no jobs exist"
          actionLabel="Create Job"
          onAction={() => router.push('/operations/jobs/create' as any)}
        />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    padding: Spacing.md,
    paddingTop: 0,
    paddingBottom: Spacing['4xl'],
  },
  jobCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  jobId: {
    fontSize: 15,
    fontWeight: '700',
  },
  jobPO: {
    fontSize: 12,
    marginTop: 1,
  },
  jobDetails: {
    gap: 4,
    marginBottom: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  jobActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
});
