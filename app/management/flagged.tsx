import { useFlagViewsStore } from '../../store/flagViewsStore';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { clearTrackingFlag, fetchTrackingFlags } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useDeliveryOrders } from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { formatEAT } from '../../utils/helpers';
import { isDeliveryFlagged, isSiteWeightFlagged, getDeliveryFlagReason } from '../../utils/siteFlags';

type TabType = 'all' | 'weight' | 'security' | 'cleared';

export default function FlaggedScreen() {
  const colors = useTheme();
  const role = useAuthStore((state) => state.user?.role);
  const deliveries = useDeliveryOrders();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // ─── Load data ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setItems(await fetchTrackingFlags());
    } catch (error: any) {
      setLoadError(error?.message || 'Unable to load flagged deliveries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const canClear = ['admin', 'admin_edit', 'superadmin', 'super_admin'].includes(
    String(role || '').toLowerCase()
  );

  // ─── Merge local flags and compute flag types ──────────────
  const displayItems = useMemo(() => {
    const localFlags = deliveries.filter(
      (item: any) => isDeliveryFlagged(item) || isSiteWeightFlagged(item) || item.securityFlag?.status === 'cleared'
    );
    const byId = new Map<string, any>();
    [...items, ...localFlags].forEach((item) => {
      const previous = byId.get(String(item.id));
      if (!previous || String(item.updatedAt || '') >= String(previous.updatedAt || '')) {
        byId.set(String(item.id), item);
      }
    });
    return [...byId.values()].map((item: any) => {
      const securityFlag = item.securityFlag;
      const weightFlagged = isSiteWeightFlagged(item) || isDeliveryFlagged(item) || !!item.weightFlag;
      const securityFlagged = securityFlag?.status === 'flagged';
      const securityCleared = securityFlag?.status === 'cleared';

      // Compute weight flag reason
      let weightReason = '';
      if (weightFlagged) {
        weightReason = getDeliveryFlagReason(item) || 'Weight variance flagged';
        if (item.netWeight) {
          weightReason = `Weight: ${item.netWeight.toFixed(1)} t (expected 19‑23 t)`;
        }
      }

      // Compute security flag reason
      const securityReason = securityFlag?.reason || 'Security review required.';

      // Location
      const location = securityFlag?.flagLocation || securityFlag?.securityLocation || '';
      const locationText =
        typeof location === 'string'
          ? location
          : [location?.latitude, location?.longitude].filter((v) => v != null).join(', ');

      const flaggedAt = securityFlag?.flaggedAt || item.siteFlaggedAt || item.flaggedAt || item.updatedAt || item.createdAt;

      return {
        ...item,
        weightFlagged,
        securityFlagged,
        securityCleared,
        weightReason,
        securityReason,
        flagLocationText: locationText,
        flaggedAtText: flaggedAt ? formatEAT(flaggedAt) : '',
        clearedAtText: securityCleared && securityFlag?.clearedAt ? formatEAT(securityFlag.clearedAt) : '',
      };
    });
  }, [deliveries, items]);

  // ─── Filter by tab ──────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return displayItems.filter((item) => {
      if (activeTab === 'all') {
        return item.weightFlagged || item.securityFlagged || item.securityCleared;
      }
      if (activeTab === 'weight') {
        return item.weightFlagged;
      }
      if (activeTab === 'security') {
        return item.securityFlagged;
      }
      if (activeTab === 'cleared') {
        return item.securityCleared;
      }
      return true;
    });
  }, [displayItems, activeTab]);

  // ─── Clear security flag ────────────────────────────────────
  const clear = async (id: string) => {
    const reason = reasonMap[id] || '';
    if (!reason.trim()) {
      return Alert.alert('Reason required', 'Enter a reason for clearing this security flag.');
    }
    try {
      const updated = await clearTrackingFlag(id, reason.trim());
      const sync = useRealTimeSyncStore.getState();
      sync.optimisticUpdate('deliveryOrders', updated);
      if (updated.driverId) {
        sync.optimisticUpdate('drivers', {
          id: updated.driverId,
          status: 'active',
          securityFlag: updated.securityFlag,
        });
      }
      if (updated.vehicleId) {
        sync.optimisticUpdate('vehicles', {
          id: updated.vehicleId,
          status: 'active',
          securityFlag: updated.securityFlag,
        });
      }
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      setSelectedItem((current: any) =>
        current?.id === id ? { ...current, ...updated } : current
      );
      setReasonMap((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (e: any) {
      Alert.alert('Unable to clear flag', e?.response?.data?.error || 'Please try again.');
    }
  };

  // ─── Render item ────────────────────────────────────────────
  const renderItem = ({ item }: { item: any }) => {
    const { weightFlagged, securityFlagged, securityCleared } = item;
    const hasAnyFlag = weightFlagged || securityFlagged || securityCleared;

    if (!hasAnyFlag) return null;

    // Determine card border colour
    let borderColor = colors.border;
    let bgColor = colors.surface;
    if (securityCleared) {
      borderColor = '#8B5CF6';
      bgColor = '#EDE9FE';
    } else if (securityFlagged) {
      borderColor = '#DC2626';
      bgColor = '#FEF2F2';
    } else if (weightFlagged) {
      borderColor = '#F59E0B';
      bgColor = '#FFFBEB';
    }

    const itemReason = reasonMap[item.id] || '';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => { useFlagViewsStore.getState().markViewed(useAuthStore.getState().user?.uid || '', item); setSelectedItem(item); }}
        style={[styles.card, { backgroundColor: bgColor, borderColor }]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleGroup}>
            <Text style={[styles.plate, { color: colors.text }]}>
              {item.plateNumber || 'Truck'}
            </Text>
            <Text style={[styles.driverName, { color: colors.textMuted }]}>
              · {item.driverName || 'Driver'}
            </Text>
          </View>
          <View style={styles.badgeContainer}>
            {weightFlagged && !securityCleared && (
              <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="scale-outline" size={12} color="#FFFFFF" />
                <Text style={styles.badgeText}>Weight</Text>
              </View>
            )}
            {securityFlagged && (
              <View style={[styles.badge, { backgroundColor: '#DC2626' }]}>
                <Ionicons name="shield-outline" size={12} color="#FFFFFF" />
                <Text style={styles.badgeText}>Security</Text>
              </View>
            )}
            {securityCleared && (
              <View style={[styles.badge, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                <Text style={styles.badgeText}>Cleared</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.vendor, { color: colors.textMuted }]}>
          {item.vendorName || 'Vendor'}
        </Text>

        {/* Weight flag reason */}
        {weightFlagged && !securityCleared && (
          <View style={styles.reasonRow}>
            <Ionicons name="scale-outline" size={16} color="#F59E0B" />
            <Text style={[styles.reason, { color: '#B45309' }]}>{item.weightReason}</Text>
          </View>
        )}

        {/* Security flag reason */}
        {(securityFlagged || securityCleared) && (
          <View style={styles.reasonRow}>
            <Ionicons name="shield-outline" size={16} color={securityCleared ? '#6D28D9' : '#DC2626'} />
            <Text style={[styles.reason, { color: securityCleared ? '#6D28D9' : '#991B1B' }]}>
              {securityCleared ? 'Security flag cleared' : item.securityReason}
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          {item.flaggedAtText ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {item.flaggedAtText}
              </Text>
            </View>
          ) : null}
          {item.clearedAtText ? (
            <View style={styles.metaItem}>
              <Ionicons name="checkmark-done-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {item.clearedAtText}
              </Text>
            </View>
          ) : null}
        </View>

        {canClear && securityFlagged && (
          <View style={styles.clearSection}>
            <TextInput
              value={itemReason}
              onChangeText={(text) =>
                setReasonMap((prev) => ({ ...prev, [item.id]: text }))
              }
              placeholder="Reason for clearing security flag..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TouchableOpacity
              onPress={() => clear(item.id)}
              style={[styles.clearButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.buttonText}>Clear security flag</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ─── Render empty state ─────────────────────────────────────
  const renderEmpty = () => {
    if (loading) return <ActivityIndicator color={colors.primaryText} style={{ marginTop: 48 }} />;
    if (loadError) {
      return (
        <Text style={{ color: colors.danger, textAlign: 'center', marginTop: 48 }}>
          {loadError}
        </Text>
      );
    }
    const messages: Record<TabType, string> = {
      all: 'No flagged items.',
      weight: 'No weight‑flagged items.',
      security: 'No security‑flagged items.',
      cleared: 'No cleared flags.',
    };
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{messages[activeTab]}</Text>
      </View>
    );
  };

  // ─── Main render ────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Segmented tabs */}
      <View style={styles.tabContainer}>
        {['all', 'weight', 'security', 'cleared'].map((tab) => {
          const isActive = activeTab === tab;
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          const icon = tab === 'all' ? 'apps' : tab === 'weight' ? 'scale' : tab === 'security' ? 'shield' : 'checkmark-circle';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab as TabType)}
            >
              <Ionicons
                name={icon as any}
                size={16}
                color={isActive ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
      />

      {/* Detail Modal */}
      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Flag Details</Text>
              <TouchableOpacity onPress={() => setSelectedItem(null)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={styles.modalBody}>
                <Text style={[styles.detailName, { color: colors.text }]}>
                  {selectedItem.plateNumber || 'Truck'} · {selectedItem.driverName || 'Driver'}
                </Text>
                <Text style={[styles.detailSub, { color: colors.textMuted }]}>
                  {selectedItem.vendorName || 'Vendor'}
                </Text>

                {/* Weight flag detail */}
                {selectedItem.weightFlagged && (
                  <>
                    <View style={styles.detailRow}>
                      <Ionicons name="scale-outline" size={18} color="#F59E0B" />
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                        Weight Flag
                      </Text>
                    </View>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedItem.weightReason}
                    </Text>
                  </>
                )}

                {/* Security flag detail */}
                {(selectedItem.securityFlagged || selectedItem.securityCleared) && (
                  <>
                    <View style={styles.detailRow}>
                      <Ionicons
                        name="shield-outline"
                        size={18}
                        color={selectedItem.securityCleared ? '#8B5CF6' : '#DC2626'}
                      />
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                        {selectedItem.securityCleared ? 'Cleared Security Flag' : 'Security Flag'}
                      </Text>
                    </View>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedItem.securityCleared
                        ? 'Flag cleared — fleet unsuspended'
                        : selectedItem.securityReason}
                    </Text>
                  </>
                )}

                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={18} color={colors.primaryText} />
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Flagged by</Text>
                </View>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {selectedItem.securityFlag?.flaggedBy ||
                    selectedItem.siteFlaggedBy ||
                    'Site weight check'}
                </Text>

                {selectedItem.flagLocationText ? (
                  <>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={18} color={colors.primaryText} />
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                        Location
                      </Text>
                    </View>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedItem.flagLocationText}
                    </Text>
                  </>
                ) : null}

                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={18} color={colors.primaryText} />
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Flagged at</Text>
                </View>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {selectedItem.flaggedAtText || '—'}
                </Text>

                {selectedItem.securityCleared && (
                  <>
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={18} color={colors.primaryText} />
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                        Cleared by
                      </Text>
                    </View>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedItem.securityFlag?.clearedBy || 'Administrator'}
                    </Text>

                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={18} color={colors.primaryText} />
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                        Cleared at
                      </Text>
                    </View>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedItem.clearedAtText || '—'}
                    </Text>

                    <View style={styles.detailRow}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primaryText} />
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                        Clearance reason
                      </Text>
                    </View>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {selectedItem.securityFlag?.resolutionReason || '—'}
                    </Text>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.closeModalButton, { backgroundColor: colors.primary }]}
                  onPress={() => setSelectedItem(null)}
                >
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  activeTab: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.xs,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  plate: {
    fontSize: 16,
    fontWeight: '800',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  vendor: {
    fontSize: 13,
    fontWeight: '400',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  reason: {
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
    flexWrap: 'wrap',
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '400',
  },
  clearSection: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    fontSize: 14,
  },
  clearButton: {
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: 11,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  modalContent: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing['4xl'],
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailSub: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 24,
  },
  closeModalButton: {
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: 11,
    marginTop: Spacing.lg,
  },
});