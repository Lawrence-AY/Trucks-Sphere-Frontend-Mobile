/**
 * Audit Log Screen - Complete action history with filters
 *
 * Features:
 *   - List all audit log entries
 *   - Filter by entity type, action, user, date
 *   - Search across entries
 *   - Tap to view full details
 *   - Pull to refresh
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { formatRelativeTime } from '../../utils/helpers';
import { AuditLogEntry } from '../../store/types';

const ENTITY_TYPES = [
  { id: '', name: 'All Types' },
  { id: 'vendor', name: 'Vendor' },
  { id: 'driver', name: 'Driver' },
  { id: 'vehicle', name: 'Vehicle' },
  { id: 'material', name: 'Material' },
  { id: 'purchase_order', name: 'Purchase Order' },
  { id: 'job', name: 'Job' },
  { id: 'user', name: 'User' },
  { id: 'quarry', name: 'Quarry' },
  { id: 'site', name: 'Site' },
  { id: 'fuel_station', name: 'Fuel Station' },
];

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3B82F6',
  warning: '#F59E0B',
  error: '#EF4444',
};

const ACTION_ICONS: Record<string, string> = {
  created: 'add-circle-outline',
  updated: 'create-outline',
  deleted: 'trash-outline',
  archived: 'archive-outline',
  cancelled: 'close-circle-outline',
  approved: 'checkmark-circle-outline',
  assigned: 'person-add-outline',
  dispatched: 'car-outline',
  completed: 'checkmark-done-outline',
  uploaded: 'cloud-upload-outline',
};

export default function AuditLogScreen() {
  const colors = useTheme();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      // In production, this would come from an AuditService
      // For now, we'll show sample data to demonstrate the UI
      const sampleEntries: AuditLogEntry[] = [
        {
          id: '1',
          action: 'created',
          entityType: 'vendor',
          entityId: 'V001',
          userId: 'user1',
          userName: 'John Admin',
          details: 'Created vendor - Mombasa Cement Ltd',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          severity: 'info',
        },
        {
          id: '2',
          action: 'updated',
          entityType: 'purchase_order',
          entityId: 'POMAT001/V001',
          userId: 'user2',
          userName: 'Mary Manager',
          details: 'Updated quantity from 100 to 150 Tonnes',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          severity: 'info',
          changes: {
            quantity: { from: 100, to: 150 },
          },
        },
        {
          id: '3',
          action: 'assigned',
          entityType: 'job',
          entityId: 'JOB001',
          userId: 'user3',
          userName: 'Peter Operator',
          details: 'Assigned driver John Kamau to job JOB001',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          severity: 'info',
        },
        {
          id: '4',
          action: 'dispatched',
          entityType: 'job',
          entityId: 'JOB001',
          userId: 'user3',
          userName: 'Peter Operator',
          details: 'Dispatched vehicle KCA 123T from quarry',
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          severity: 'info',
        },
        {
          id: '5',
          action: 'completed',
          entityType: 'job',
          entityId: 'JOB001',
          userId: 'user4',
          userName: 'Sarah Site',
          details: 'Delivery completed at Westlands Site',
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          severity: 'info',
        },
        {
          id: '6',
          action: 'cancelled',
          entityType: 'purchase_order',
          entityId: 'POMAT002/V002',
          userId: 'user1',
          userName: 'John Admin',
          details: 'Cancelled purchase order - insufficient material',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          severity: 'warning',
        },
        {
          id: '7',
          action: 'deleted',
          entityType: 'driver',
          entityId: 'D005',
          userId: 'user1',
          userName: 'John Admin',
          details: 'Deleted driver - James Kariuki',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          severity: 'error',
        },
      ];
      setEntries(sampleEntries);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  }

  function getFilteredEntries(): AuditLogEntry[] {
    let result = [...entries];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          e.entityType.toLowerCase().includes(q) ||
          e.entityId.toLowerCase().includes(q) ||
          e.userName.toLowerCase().includes(q) ||
          e.details.toLowerCase().includes(q)
      );
    }
    if (entityFilter) {
      result = result.filter((e) => e.entityType === entityFilter);
    }
    return result;
  }

  function renderEntry({ item }: { item: AuditLogEntry }) {
    const icon = ACTION_ICONS[item.action] || 'ellipse-outline';
    const color = SEVERITY_COLORS[item.severity] || colors.textMuted;

    return (
      <TouchableOpacity
        style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/audit-log/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.entryHeader}>
          <View style={[styles.entryIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon as any} size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.entryRow}>
              <Text style={[styles.entryAction, { color: colors.text }]}>
                {item.action.charAt(0).toUpperCase() + item.action.slice(1)}
              </Text>
              <Badge
                label={item.entityType.replace('_', ' ')}
                variant={item.severity === 'error' ? 'danger' : item.severity === 'warning' ? 'warning' : 'default'}
                size="sm"
              />
            </View>
            <Text style={[styles.entryDetails, { color: colors.textMuted }]} numberOfLines={2}>
              {item.details}
            </Text>
            <View style={styles.entryMeta}>
              <Text style={[styles.entryUser, { color: colors.textMuted }]}>
                {item.userName}
              </Text>
              <Text style={[styles.entryTime, { color: colors.textMuted }]}>
                {formatRelativeTime(item.timestamp)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Audit Log</Text>
        </View>
        <LoadingSkeleton lines={6} variant="card" />
      </View>
    );
  }

  const filtered = getFilteredEntries();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Audit Log</Text>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search audit log..."
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

        {/* Entity Filter */}
        <Select
          label=""
          value={entityFilter || ''}
          options={ENTITY_TYPES}
          onSelect={(v) => setEntityFilter(v || null)}
          placeholder="Filter by entity type..."
        />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={search || entityFilter ? 'No entries found' : 'No audit entries'}
          subtitle={search || entityFilter ? 'Try different search or filter' : 'Audit entries will appear here'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
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
  entryCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  entryAction: {
    fontSize: 14,
    fontWeight: '700',
  },
  entryDetails: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryUser: {
    fontSize: 12,
  },
  entryTime: {
    fontSize: 12,
  },
});
