import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders, updateDeliveryOrder } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

/* ─────────── Phase 1: Schedule Tab — Site Weight In ─────────── */

export default function OperatorSiteDashboardScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ─── Weight In form state (per job) ───
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [weightInInputs, setWeightInInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});

  // ─── Success modal for Phase 1 completion ───
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successJob, setSuccessJob] = useState<any>(null);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const data = (await fetchDeliveryOrders()) || [];
      setDeliveries(data);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ─── Filtered & categorized data ─── */

  // Trucks that have been dispatched from quarry (non-cancelled)
  const allScheduled = useMemo(
    () => deliveries.filter((d) => d.status !== 'cancelled'),
    [deliveries],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allScheduled.filter(
      (d) =>
        !q ||
        [d.jobId, d.driverName, d.plateNumber, d.materialName].some((v) =>
          String(v || '').toLowerCase().includes(q),
        ),
    );
  }, [allScheduled, search]);

  // Stats
  const stats = useMemo(() => {
    const pendingWeighIn = allScheduled.filter(
      (d) =>
        !d.siteWeighInWeight &&
        d.status !== 'completed' &&
        d.status !== 'delivered' &&
        d.status !== 'weighed_in',
    );
    const weighedIn = allScheduled.filter(
      (d) =>
        (d.siteWeighInWeight || d.status === 'weighed_in') &&
        d.status !== 'completed' &&
        d.status !== 'delivered',
    );
    const completed = allScheduled.filter(
      (d) => d.status === 'completed' || d.status === 'delivered',
    );
    return {
      pending: pendingWeighIn.length,
      weighedIn: weighedIn.length,
      completed: completed.length,
    };
  }, [allScheduled]);

  /* ─── Weight In Handlers ─── */

  const getWeightInput = (jobId: string): string => {
    return weightInInputs[jobId] || '';
  };

  const setWeightInput = (jobId: string, value: string) => {
    setWeightInInputs((prev) => ({ ...prev, [jobId]: value }));
    // Clear error when user types
    if (submitErrors[jobId]) {
      setSubmitErrors((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const toggleExpand = (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(jobId);
      // Clear any previous error
      setSubmitErrors((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const handleConfirmWeightIn = async (job: any) => {
    const inputValue = getWeightInput(job.id);
    const weightInNum = parseFloat(inputValue);

    if (isNaN(weightInNum) || weightInNum <= 0) {
      setSubmitErrors((prev) => ({
        ...prev,
        [job.id]: 'Please enter a valid weight (> 0).',
      }));
      return;
    }

    // Optional: warn if weight seems unreasonable compared to expected
    const expected = job.quantityOrdered || 0;
    if (weightInNum < expected * 0.3) {
      Alert.alert(
        'Low Weight Warning',
        `The Site Arrival Weight (${weightInNum.toFixed(1)}T) is significantly lower than the expected load (${expected}T). Do you want to proceed?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Proceed',
            onPress: () => submitWeightIn(job, weightInNum),
          },
        ],
      );
      return;
    }

    submitWeightIn(job, weightInNum);
  };

  const submitWeightIn = async (job: any, weightInNum: number) => {
    setSubmitting((prev) => ({ ...prev, [job.id]: true }));
    setSubmitErrors((prev) => {
      const next = { ...prev };
      delete next[job.id];
      return next;
    });

    try {
      const now = new Date().toISOString();
      await updateDeliveryOrder(job.id, {
        siteWeighInWeight: weightInNum,
        siteWeighInAt: now,
        status: 'weighed_in',
        updatedAt: now,
      });

      // Update local state
      setDeliveries((current) =>
        current.map((item) =>
          item.id === job.id
            ? {
                ...item,
                siteWeighInWeight: weightInNum,
                siteWeighInAt: now,
                status: 'weighed_in',
                updatedAt: now,
              }
            : item,
        ),
      );

      // Clear input
      setWeightInInputs((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });

      setExpandedJobId(null);

      // Show success and offer to navigate to Weights tab
      setSuccessJob({
        ...job,
        siteWeighInWeight: weightInNum,
        siteWeighInAt: now,
        status: 'weighed_in',
      });
      setSuccessModalVisible(true);
    } catch (error: any) {
      setSubmitErrors((prev) => ({
        ...prev,
        [job.id]: error?.message || 'Failed to submit weight. Please try again.',
      }));
    } finally {
      setSubmitting((prev) => ({ ...prev, [job.id]: false }));
    }
  };

  const navigateToWeights = () => {
    setSuccessModalVisible(false);
    setSuccessJob(null);
    router.navigate('/operator-site/weights' as any);
  };

  /* ─── Render ─── */

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageShell
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={colors.primary}
          />
        }
      >
        {/* Metric Tiles */}
        <View style={styles.metricRow}>
          <MetricTile
            icon="hourglass-outline"
            label="Pending Weigh In"
            value={stats.pending}
            tone={colors.warning}
          />
          <MetricTile
            icon="checkmark-circle-outline"
            label="Weighed In"
            value={stats.weighedIn}
            tone="#3B82F6"
          />
          <MetricTile
            icon="checkmark-done"
            label="Completed"
            value={stats.completed}
            tone={colors.success}
          />
        </View>

        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search job, driver, plate, material..."
        />
        <SectionTitle title={`Schedule — ${filtered.length} deliveries`} />

        {loading ? (
          <DataCard>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>
              Loading schedule...
            </Text>
          </DataCard>
        ) : filtered.length ? (
          filtered.slice(0, 30).map((item) => {
            const hasSiteWeighIn =
              item.siteWeighInWeight != null || item.status === 'weighed_in';
            const hasQuarryWeights =
              item.weighInWeight != null && item.weighOutWeight != null;
            const quarryNet =
              item.netWeight ??
              (hasQuarryWeights
                ? item.weighInWeight - item.weighOutWeight
                : null);
            const isExpanded = expandedJobId === item.id;
            const isSubmitting = submitting[item.id];
            const error = submitErrors[item.id];
            const weightInVal = getWeightInput(item.id);
            const isCompleted =
              item.status === 'completed' || item.status === 'delivered';
            const isWeighedIn =
              hasSiteWeighIn && !isCompleted;

            return (
              <DataCard key={item.id}>
                {/* Card Header */}
                <TouchableOpacity
                  onPress={() => !isCompleted && toggleExpand(item.id)}
                  activeOpacity={isCompleted ? 1 : 0.7}
                  style={styles.cardHeaderTouchable}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.jobId, { color: colors.text }]}>
                        {item.jobId}
                      </Text>
                      <Text
                        style={[styles.poText, { color: colors.textMuted }]}
                      >
                        {item.poNumber || 'No PO'}
                      </Text>
                    </View>
                    <View style={styles.cardHeaderRight}>
                      {isWeighedIn && (
                        <View
                          style={[
                            styles.weighedInBadge,
                            { backgroundColor: '#3B82F615', borderColor: '#3B82F633' },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#3B82F6"
                          />
                          <Text
                            style={[
                              styles.weighedInBadgeText,
                              { color: '#3B82F6' },
                            ]}
                          >
                            Weighed In
                          </Text>
                        </View>
                      )}
                      <StatusPill status={item.status} compact />
                    </View>
                  </View>

                  <DetailRow
                    icon="person-outline"
                    value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`}
                  />
                  <DetailRow
                    icon="cube-outline"
                    value={`${item.materialName || 'Material'} · ${item.quantityOrdered || 0} tonnes`}
                  />
                  <DetailRow
                    icon="business-outline"
                    value={`Vendor: ${item.vendorName || 'N/A'}`}
                  />
                  <DetailRow
                    icon="location-outline"
                    value={`From: ${item.quarryName || 'Quarry'}`}
                  />

                  {/* Quarry Net Weight (if available) */}
                  {quarryNet != null && (
                    <View
                      style={[
                        styles.quarryNetBadge,
                        { backgroundColor: '#2563EB12', borderColor: '#2563EB33' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quarryNetLabel,
                          { color: '#2563EB' },
                        ]}
                      >
                        Quarry Net: {quarryNet.toFixed(1)}T
                      </Text>
                    </View>
                  )}

                  {/* Site Weigh In value (if already completed) */}
                  {hasSiteWeighIn && item.siteWeighInWeight != null && (
                    <View
                      style={[
                        styles.siteWeightBadge,
                        { backgroundColor: '#10B98112', borderColor: '#10B98133' },
                      ]}
                    >
                      <Ionicons name="scale-outline" size={12} color="#10B981" />
                      <Text
                        style={[
                          styles.siteWeightLabel,
                          { color: '#10B981' },
                        ]}
                      >
                        Site Arrival: {item.siteWeighInWeight.toFixed(1)}T
                      </Text>
                    </View>
                  )}

                  <Text
                    style={[styles.timestamp, { color: colors.textTertiary }]}
                  >
                    {isCompleted
                      ? `Completed: ${formatEAT(item.receivedAt || item.updatedAt || item.createdAt)}`
                      : hasSiteWeighIn
                      ? `Weighed In: ${formatEAT(item.siteWeighInAt || item.updatedAt)}`
                      : `Dispatched: ${formatEAT(item.weighOutAt || item.updatedAt || item.createdAt)}`}
                  </Text>

                  {/* Tap hint for non-completed items */}
                  {!isCompleted && !isExpanded && (
                    <View
                      style={[
                        styles.tapHint,
                        { backgroundColor: `${colors.primary}08` },
                      ]}
                    >
                      <Ionicons
                        name="hand-left-outline"
                        size={12}
                        color={colors.primary}
                      />
                      <Text
                        style={[styles.tapHintText, { color: colors.primary }]}
                      >
                        {hasSiteWeighIn
                          ? 'Weigh In completed — go to Weights tab'
                          : 'Tap to record Site Arrival Weight'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* ─── Expanded Weight In Form ─── */}
                {isExpanded && !isCompleted && !hasSiteWeighIn && (
                  <View style={styles.weightInSection}>
                    <View
                      style={[
                        styles.weightInDivider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <View
                      style={[
                        styles.weightInHeader,
                        { backgroundColor: '#F59E0B10', borderColor: '#F59E0B33' },
                      ]}
                    >
                      <View style={styles.weightInStageBadge}>
                        <Ionicons
                          name="download-outline"
                          size={18}
                          color="#F59E0B"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.weightInTitle,
                            { color: colors.text },
                          ]}
                        >
                          Site Arrival Weight (Weight In)
                        </Text>
                        <Text
                          style={[
                            styles.weightInSubtitle,
                            { color: colors.textMuted },
                          ]}
                        >
                          Weigh the fully-loaded truck upon arrival at site.
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.weightInputContainer,
                        {
                          borderColor: error
                            ? colors.danger
                            : '#F59E0B',
                          backgroundColor: colors.inputBg,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.weightInputField, { color: colors.text }]}
                        placeholder="0.0"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={weightInVal}
                        onChangeText={(value) =>
                          setWeightInput(item.id, value)
                        }
                        autoFocus
                      />
                      <Text
                        style={[
                          styles.weightInputSuffix,
                          { color: colors.textMuted },
                        ]}
                      >
                        Tonnes
                      </Text>
                    </View>

                    {error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : null}

                    <View style={styles.weightInActions}>
                      <TouchableOpacity
                        style={[
                          styles.cancelWeightInBtn,
                          { borderColor: colors.border },
                        ]}
                        onPress={() => toggleExpand(item.id)}
                        disabled={isSubmitting}
                      >
                        <Text
                          style={[
                            styles.cancelWeightInText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.confirmWeightInBtn,
                          {
                            backgroundColor:
                              weightInVal && !isSubmitting
                                ? '#F59E0B'
                                : colors.border,
                          },
                        ]}
                        onPress={() => handleConfirmWeightIn(item)}
                        disabled={!weightInVal || isSubmitting}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color="#FFFFFF"
                          />
                        )}
                        <Text style={styles.confirmWeightInText}>
                          {isSubmitting
                            ? 'Submitting...'
                            : 'Confirm & Submit'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </DataCard>
            );
          })
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="No deliveries"
            subtitle="No job cards have been dispatched yet."
          />
        )}

        {/* Bottom spacing */}
        <View style={{ height: Spacing['4xl'] }} />
      </PageShell>

      {/* ─── Phase 1 Success Modal ─── */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.successDialog,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.successIconWrap,
                { backgroundColor: '#10B98115' },
              ]}
            >
              <Ionicons name="checkmark-circle" size={44} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>
              Weight In Recorded
            </Text>
            <Text style={[styles.successSub, { color: colors.textMuted }]}>
              {successJob
                ? `Site Arrival Weight of ${successJob.siteWeighInWeight?.toFixed(1)}T recorded for ${successJob.jobId}.`
                : 'Site arrival weight has been recorded successfully.'}
            </Text>
            <Text style={[styles.successHint, { color: colors.textMuted }]}>
              The truck has been moved to the Weights tab for Weight Out and
              finalization.
            </Text>
            <View style={styles.successActions}>
              <TouchableOpacity
                style={[
                  styles.stayBtn,
                  { borderColor: colors.border },
                ]}
                onPress={() => setSuccessModalVisible(false)}
              >
                <Text
                  style={[
                    styles.stayBtnText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Stay Here
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.goBtn,
                  { backgroundColor: colors.primary },
                ]}
                onPress={navigateToWeights}
              >
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.goBtnText}>Go to Weights</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.sm },
  // Card
  cardHeaderTouchable: {},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobId: { fontSize: 16, fontWeight: '700' },
  poText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  quarryNetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  quarryNetLabel: { fontSize: 12, fontWeight: '700' },
  siteWeightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  siteWeightLabel: { fontSize: 12, fontWeight: '700' },
  weighedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  weighedInBadgeText: { fontSize: 11, fontWeight: '700' },
  timestamp: { fontSize: 12, marginTop: Spacing.sm },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: 8,
  },
  tapHintText: { fontSize: 11, fontWeight: '700' },
  // Weight In Form (expanded)
  weightInSection: {
    marginTop: Spacing.md,
  },
  weightInDivider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  weightInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  weightInStageBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  weightInSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  weightInputContainer: {
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  weightInputField: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
  },
  weightInputSuffix: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: Spacing.sm,
  },
  weightInActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelWeightInBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelWeightInText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmWeightInBtn: {
    flex: 2,
    minHeight: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  confirmWeightInText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  // Success Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  successDialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  successHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: Spacing.lg,
    fontStyle: 'italic',
  },
  successActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  stayBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stayBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  goBtn: {
    flex: 2,
    minHeight: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  goBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
