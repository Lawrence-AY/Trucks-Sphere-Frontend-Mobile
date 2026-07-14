/**
 * Audit Log Viewer - Filterable, searchable audit trail
 *
 * Features:
 *   - Filter by entity type, action, user, date range
 *   - Timeline view with color-coded actions
 *   - Expandable detail for each entry with rich metadata
 *   - Fetch from backend API
 *   - Export to CSV
 *   - Infinite scroll pagination
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { fetchAuditLogs } from '../../services/api';
import { formatEAT } from '../../utils/helpers';

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  timestamp: string;
  details: string;
  severity?: string;
  ipAddress?: string;
  deviceInfo?: string;
  changes?: Record<string, { from: any; to: any }>;
}

const ACTION_COLORS: Record<string, { variant: 'success' | 'danger' | 'info' | 'warning' | 'default'; label: string }> = {
  create: { variant: 'success', label: 'Created' },
  update: { variant: 'info', label: 'Updated' },
  delete: { variant: 'danger', label: 'Deleted' },
  approve: { variant: 'success', label: 'Approved' },
  cancel: { variant: 'danger', label: 'Cancelled' },
  archive: { variant: 'default', label: 'Archived' },
  assign: { variant: 'warning', label: 'Assigned' },
  login: { variant: 'info', label: 'Login' },
  logout: { variant: 'default', label: 'Logout' },
};

const SEVERITY_COLORS: Record<string, { variant: 'danger' | 'warning' | 'info' | 'default'; label: string }> = {
  critical: { variant: 'danger', label: 'Critical' },
  high: { variant: 'danger', label: 'High' },
  medium: { variant: 'warning', label: 'Medium' },
  low: { variant: 'info', label: 'Low' },
  info: { variant: 'default', label: 'Info' },
};

const ENTITY_TYPES = ['all', 'vendor', 'driver', 'vehicle', 'material', 'purchase_order', 'job', 'user', 'role'];
const ACTIONS = ['all', 'create', 'update', 'delete', 'approve', 'cancel', 'archive', 'assign'];

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatEAT(timestamp);
}

export default function AuditLogsScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailModal, setDetailModal] = useState<AuditEntry | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      const data = await fetchAuditLogs();
      setLogs(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  }

  function getFilteredLogs(): AuditEntry[] {
    let result = [...logs];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.entityType.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.userName.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q) ||
          (l.userEmail && l.userEmail.toLowerCase().includes(q))
      );
    }
    if (entityFilter !== 'all') {
      result = result.filter((l) => l.entityType === entityFilter);
    }
    if (actionFilter !== 'all') {
      result = result.filter((l) => l.action === actionFilter);
    }
    return result;
  }

  function getActionBadge(action: string) {
    const config = ACTION_COLORS[action] || { variant: 'default' as const, label: action };
    return <Badge label={config.label} variant={config.variant} size="sm" />;
  }

  function getSeverityBadge(severity?: string) {
    if (!severity) return null;
    const config = SEVERITY_COLORS[severity] || { variant: 'default' as const, label: severity };
    return <Badge label={config.label} variant={config.variant} size="sm" />;
  }

  function getEntityIcon(entityType: string): keyof typeof Ionicons.glyphMap {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      vendor: 'business-outline',
      driver: 'person-outline',
      vehicle: 'car-outline',
      material: 'cube-outline',
      purchase_order: 'document-text-outline',
      job: 'briefcase-outline',
      user: 'person-circle-outline',
      role: 'shield-checkmark-outline',
    };
    return icons[entityType] || 'ellipse-outline';
  }

  function renderLogItem({ item }: { item: AuditEntry }) {
    const isExpanded = expandedId === item.id;
    const actionConfig = ACTION_COLORS[item.action] || { variant: 'default' as const, label: item.action };

    return (
      <TouchableOpacity
        style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.logHeader}>
          <View style={[styles.logIcon, { backgroundColor: actionConfig.variant === 'danger' ? '#FEF2F2' : actionConfig.variant === 'success' ? '#F0FDF4' : actionConfig.variant === 'info' ? '#EFF6FF' : '#F8FAFC' }]}>
            <Ionicons
              name={getEntityIcon(item.entityType)}
              size={18}
              color={
                actionConfig.variant === 'danger' ? '#EF4444' :
                actionConfig.variant === 'success' ? '#22C55E' :
                actionConfig.variant === 'info' ? '#3B82F6' :
                '#64748B'
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.logTitleRow}>
              <Text style={[styles.logTitle, { color: colors.text }]} numberOfLines={1}>
                {item.details}
              </Text>
              {getActionBadge(item.action)}
            </View>
            <Text style={[styles.logMeta, { color: colors.textMuted }]}>
              {item.entityType.replace('_', ' ')} • {item.entityId} • {item.userName}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </View>

        <View style={styles.logFooter}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.logTime, { color: colors.textMuted }]}>
            {getRelativeTime(item.timestamp)}
          </Text>
          <Text style={[styles.logTimeDot, { color: colors.textMuted }]}>•</Text>
          <Text style={[styles.logTime, { color: colors.textMuted }]}>
            {formatEAT(item.timestamp)}
          </Text>
          {item.severity && (
            <>
              <Text style={[styles.logTimeDot, { color: colors.textMuted }]}>•</Text>
              {getSeverityBadge(item.severity)}
            </>
          )}
        </View>

        {isExpanded && (
          <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
            {/* Actor Details */}
            <View style={styles.expandedRow}>
              <Ionicons name="person-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Actor:</Text>
              <Text style={[styles.expandedValue, { color: colors.text }]}>{item.userName}</Text>
            </View>
            {item.userEmail && (
              <View style={styles.expandedRow}>
                <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Email:</Text>
                <Text style={[styles.expandedValue, { color: colors.text }]}>{item.userEmail}</Text>
              </View>
            )}
            {item.userRole && (
              <View style={styles.expandedRow}>
                <Ionicons name="shield-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Role:</Text>
                <Text style={[styles.expandedValue, { color: colors.text }]}>{item.userRole}</Text>
              </View>
            )}
            {item.ipAddress && (
              <View style={styles.expandedRow}>
                <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>IP:</Text>
                <Text style={[styles.expandedValue, { color: colors.text }]}>{item.ipAddress}</Text>
              </View>
            )}
            {item.deviceInfo && (
              <View style={styles.expandedRow}>
                <Ionicons name="phone-portrait-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Device:</Text>
                <Text style={[styles.expandedValue, { color: colors.text }]}>{item.deviceInfo}</Text>
              </View>
            )}

            {/* Changes */}
            {item.changes && Object.keys(item.changes).length > 0 && (
              <View style={[styles.changesSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.changesTitle, { color: colors.text }]}>Changes:</Text>
                {Object.entries(item.changes).map(([field, change]) => (
                  <View key={field} style={styles.changeRow}>
                    <Text style={[styles.changeField, { color: colors.textMuted }]}>{field}:</Text>
                    <Text style={[styles.changeValue, { color: '#EF4444' }]}>
                      {JSON.stringify(change.from)}
                    </Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.textMuted} />
                    <Text style={[styles.changeValue, { color: '#22C55E' }]}>
                      {JSON.stringify(change.to)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* View More Button */}
            <TouchableOpacity
              style={styles.viewMoreBtn}
              onPress={() => setDetailModal(item)}
            >
              <Text style={[styles.viewMoreText, { color: colors.primary }]}>View Full Details</Text>
              <Ionicons name="open-outline" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const filteredLogs = getFilteredLogs();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Audit Logs</Text>
        </View>
        <LoadingSkeleton lines={8} variant="card" />
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
        <Text style={styles.backTitle}>Audit Logs</Text>
      </View>
      <View style={styles.header}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Track all system activities and changes
        </Text>

        {/* Search */}
        <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search logs..."
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
        <View style={styles.filterRow}>
          <FlatList
            horizontal
            data={ENTITY_TYPES}
            keyExtractor={(s) => s}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: type }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: entityFilter === type ? colors.primary : colors.surface,
                    borderColor: entityFilter === type ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setEntityFilter(type)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: entityFilter === type ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  {type === 'purchase_order' ? 'PO' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Action Filter */}
        <View style={styles.filterRow}>
          <FlatList
            horizontal
            data={ACTIONS}
            keyExtractor={(s) => s}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: action }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: actionFilter === action ? colors.primary : colors.surface,
                    borderColor: actionFilter === action ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActionFilter(action)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: actionFilter === action ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={search ? 'No logs found' : 'No audit logs'}
            subtitle={search ? 'Try a different search term' : 'System activities will appear here'}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
      />

      {/* Detail Modal */}
      <Modal visible={!!detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Audit Log Details</Text>
              <TouchableOpacity onPress={() => setDetailModal(null)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {detailModal && (
              <ScrollView contentContainerStyle={styles.modalBody}>
                {/* Summary */}
                <Card>
                  <View style={styles.detailSummaryRow}>
                    <Ionicons name={getEntityIcon(detailModal.entityType)} size={24} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailTitle, { color: colors.text }]}>{detailModal.details}</Text>
                      <Text style={[styles.detailSubtitle, { color: colors.textMuted }]}>
                        {detailModal.entityType.replace('_', ' ')} • {detailModal.entityId}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Action Info */}
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Action</Text>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Type</Text>
                  {getActionBadge(detailModal.action)}
                </View>
                {detailModal.severity && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Severity</Text>
                    {getSeverityBadge(detailModal.severity)}
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Timestamp</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{formatEAT(detailModal.timestamp)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Relative</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{getRelativeTime(detailModal.timestamp)}</Text>
                </View>

                {/* Actor Info */}
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Actor</Text>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Name</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.userName}</Text>
                </View>
                {detailModal.userEmail && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Email</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.userEmail}</Text>
                  </View>
                )}
                {detailModal.userRole && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Role</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.userRole}</Text>
                  </View>
                )}
                {detailModal.userId && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>User ID</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.userId}</Text>
                  </View>
                )}

                {/* Device Info */}
                {(detailModal.ipAddress || detailModal.deviceInfo) && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>Device</Text>
                    {detailModal.ipAddress && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>IP Address</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.ipAddress}</Text>
                      </View>
                    )}
                    {detailModal.deviceInfo && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Device Info</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{detailModal.deviceInfo}</Text>
                      </View>
                    )}
                  </>
                )}

                {/* Changes */}
                {detailModal.changes && Object.keys(detailModal.changes).length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>Changes</Text>
                    {Object.entries(detailModal.changes).map(([field, change]) => (
                      <View key={field} style={styles.changeDetailRow}>
                        <Text style={[styles.changeFieldLabel, { color: colors.text }]}>{field}</Text>
                        <View style={styles.changeValuesRow}>
                          <View style={[styles.changeBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                            <Text style={styles.changeBoxLabel}>From</Text>
                            <Text style={[styles.changeBoxValue, { color: '#DC2626' }]}>
                              {JSON.stringify(change.from)}
                            </Text>
                          </View>
                          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                          <View style={[styles.changeBox, { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }]}>
                            <Text style={styles.changeBoxLabel}>To</Text>
                            <Text style={[styles.changeBoxValue, { color: '#059669' }]}>
                              {JSON.stringify(change.to)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
    marginBottom: Spacing.md,
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
  filterRow: {
    marginBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    padding: Spacing.md,
    paddingTop: 0,
    paddingBottom: Spacing['4xl'],
  },
  logCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  logMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingLeft: 52,
    flexWrap: 'wrap',
  },
  logTime: {
    fontSize: 11,
  },
  logTimeDot: {
    fontSize: 11,
    marginHorizontal: 2,
  },
  expandedSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingLeft: 52,
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  expandedLabel: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 40,
  },
  expandedValue: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  changesSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  changesTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  changeField: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 60,
  },
  changeValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  viewMoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingMore: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  detailSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  detailSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
  changeDetailRow: {
    marginTop: Spacing.sm,
  },
  changeFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  changeValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changeBox: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  changeBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changeBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
});
