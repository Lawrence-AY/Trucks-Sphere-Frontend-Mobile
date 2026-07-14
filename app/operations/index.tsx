/**
 * Operations Dashboard - Dispatch Queue & Active Jobs
 *
 * This is the main screen for Quarry Operators and Site Operators.
 * Shows active jobs, pending dispatch, and allows quick status updates.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { jobRepository } from '../../services/repositories/JobRepository';
import { Job } from '../../store/types';

const STATUS_SECTIONS = [
  { key: 'dispatch', label: 'Pending Dispatch', statuses: ['draft', 'assigned', 'ready'], icon: 'time-outline' as const },
  { key: 'active', label: 'Active Deliveries', statuses: ['loading', 'quarry_in', 'quarry_out', 'in_transit', 'site_in', 'offloading'], icon: 'car-outline' as const },
  { key: 'completed', label: 'Completed Today', statuses: ['site_out', 'receipt_uploaded', 'reconciliation', 'completed'], icon: 'checkmark-circle-outline' as const },
];

export default function OperationsDashboard() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<string>('dispatch');

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const data = await jobRepository.getAll();
      setJobs(data);
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

  function getJobsByStatuses(statuses: string[]): Job[] {
    let result = jobs.filter((j) => statuses.includes(j.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.jobId?.toLowerCase().includes(q) ||
          j.poNumber?.toLowerCase().includes(q) ||
          j.driverName?.toLowerCase().includes(q) ||
          j.plateNumber?.toLowerCase().includes(q) ||
          j.materialName?.toLowerCase().includes(q)
      );
    }
    return result;
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

  function getNextAction(job: Job): string {
    switch (job.status) {
      case 'draft': return 'Assign Driver';
      case 'assigned': return 'Assign Vehicle';
      case 'ready': return 'Start Dispatch';
      case 'loading': return 'Record Quarry In';
      case 'quarry_in': return 'Record Quarry Out';
      case 'quarry_out': return 'Track to Site';
      case 'in_transit': return 'Record Site In';
      case 'site_in': return 'Start Offloading';
      case 'offloading': return 'Record Site Out';
      case 'site_out': return 'Upload Receipt';
      case 'receipt_uploaded': return 'Reconcile';
      default: return 'View Details';
    }
  }

  function renderJobItem(job: Job) {
    return (
      <TouchableOpacity
        key={job.id}
        style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/operations/jobs/${job.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.jobHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.jobId, { color: colors.text }]}>{job.jobId || job.id.slice(0, 8)}</Text>
            <Text style={[styles.jobPO, { color: colors.textMuted }]}>PO: {job.poNumber}</Text>
          </View>
          <Badge label={job.status?.replace('_', ' ') || 'unknown'} variant={getStatusVariant(job.status)} size="sm" dot />
        </View>

        <View style={styles.jobDetails}>
          <View style={styles.jobDetailItem}>
            <Ionicons name="person-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.jobDetailText, { color: colors.text }]} numberOfLines={1}>{job.driverName || 'Unassigned'}</Text>
          </View>
          <View style={styles.jobDetailItem}>
            <Ionicons name="car-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.jobDetailText, { color: colors.text }]} numberOfLines={1}>{job.plateNumber || 'Unassigned'}</Text>
          </View>
          <View style={styles.jobDetailItem}>
            <Ionicons name="cube-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.jobDetailText, { color: colors.text }]} numberOfLines={1}>
              {job.materialName} - {job.quantityDispatched || job.quantityOrdered} {job.unit}
            </Text>
          </View>
        </View>

        <View style={[styles.jobAction, { borderTopColor: colors.border }]}>
          <Text style={[styles.nextAction, { color: colors.primary }]}>
            {getNextAction(job)}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  }

  function renderSection(section: typeof STATUS_SECTIONS[0]) {
    const sectionJobs = getJobsByStatuses(section.statuses);
    const isExpanded = expandedSection === section.key;

    if (sectionJobs.length === 0 && !isExpanded) return null;

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(isExpanded ? '' : section.key)}
        >
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name={section.icon} size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.label}</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            <Badge label={`${sectionJobs.length}`} variant="default" size="sm" />
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            {sectionJobs.length === 0 ? (
              <Text style={[styles.emptySection, { color: colors.textMuted }]}>
                No jobs in this section
              </Text>
            ) : (
              sectionJobs.map(renderJobItem)
            )}
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Operations</Text>
        </View>
        <LoadingSkeleton lines={6} variant="card" />
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
        <Text style={styles.backTitle}>Operations</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Operations</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Dispatch Queue & Active Jobs
            </Text>
          </View>
          <Button
            title="New Job"
            onPress={() => router.push('/operations/jobs/create' as any)}
            icon="add-circle-outline"
            size="sm"
          />
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search jobs..."
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
        data={STATUS_SECTIONS}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => renderSection(item)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="car-outline"
            title="No jobs found"
            subtitle="Create a new job to get started"
            actionLabel="New Job"
            onAction={() => router.push('/operations/jobs/create' as any)}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
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
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionContent: {
    gap: Spacing.sm,
  },
  emptySection: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontSize: 14,
  },
  jobCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
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
    marginBottom: Spacing.sm,
  },
  jobDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobDetailText: {
    fontSize: 13,
  },
  jobAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextAction: {
    fontSize: 13,
    fontWeight: '600',
  },
});
