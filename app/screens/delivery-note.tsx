import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDeliveryOrders, fetchCheckpoints, fetchWeighments } from '../../services/api';
import { formatEAT, formatStatus, getStatusColor, formatWeight, formatCurrency, JOURNEY_STEPS } from '../../utils/helpers';

const NAVY = '#1B2A4A';

export default function DeliveryNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [searchJobId, setSearchJobId] = useState(id || '');
  const [delivery, setDelivery] = useState<any>(null);
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [weighments, setWeighments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async (jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    setError('');

    try {
      const deliveries = await fetchDeliveryOrders({ jobId });
      if (!deliveries || deliveries.length === 0) {
        setError(`No delivery found for Delivery Note: ${jobId}`);
        setDelivery(null);
        setAllTrips([]);
        setCheckpoints([]);
        setWeighments([]);
        setLoading(false);
        return;
      }

      // Find the main one (first), and all trips for this job
      setDelivery(deliveries[0]);
      setAllTrips(deliveries);

      // Fetch checkpoints for this job
      const cps = await fetchCheckpoints({ jobId });
      setCheckpoints(cps || []);

      // Fetch weighments for this job
      const wm = await fetchWeighments({ jobId });
      setWeighments(wm || []);
    } catch (e: any) {
      setError('Failed to load delivery data');
      console.error(e);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      setSearchJobId(id);
      loadData(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleSearch = () => {
    loadData(searchJobId.trim());
  };

  const handleShare = async () => {
    if (!delivery) return;
    const netWeight = delivery.netWeight || (delivery.weighInWeight && delivery.weighOutWeight
      ? (delivery.weighInWeight - delivery.weighOutWeight).toFixed(1) : '—');
    const msg = `DELIVERY NOTE #${delivery.jobId}
PO: ${delivery.poNumber}
Vendor: ${delivery.vendorName}
Driver: ${delivery.driverName}
Truck: ${delivery.plateNumber}
Material: ${delivery.materialName} | Qty: ${delivery.quantityOrdered} ${delivery.unit || 'tonnes'}
From: ${delivery.quarryName} → To: ${delivery.siteName}
Net Weight: ${netWeight} tonnes
Status: ${delivery.status.replace(/_/g, ' ').toUpperCase()}
${formatEAT(delivery.createdAt)}`;
    await Share.share({ message: msg, title: 'Delivery Note' });
  };

  // Sort checkpoints chronologically
  const sortedCheckpoints = [...checkpoints].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Build journey timeline by merging JOURNEY_STEPS with checkpoints
  const completedTypes = new Set(sortedCheckpoints.map(cp => cp.type));
  const currentStepIdx = (() => {
    for (let i = JOURNEY_STEPS.length - 1; i >= 0; i--) {
      if (completedTypes.has(JOURNEY_STEPS[i].type)) return i;
    }
    return -1;
  })();

  const weighIn = weighments.find(w => w.type === 'weigh_in');
  const weighOut = weighments.find(w => w.type === 'weigh_out');
  const weighInWt = weighIn?.weight || delivery?.weighInWeight;
  const weighOutWt = weighOut?.weight || delivery?.weighOutWeight;
  const netWeight = delivery?.netWeight || (weighInWt && weighOutWt ? (weighInWt - weighOutWt).toFixed(1) : null);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Search Bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by Delivery Note (e.g. JOB-2025-0001)"
          placeholderTextColor={colors.textMuted}
          value={searchJobId}
          onChangeText={setSearchJobId}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={handleSearch}>
          <Ionicons name="arrow-forward-circle" size={22} color={NAVY} />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading delivery data...</Text>
        </View>
      )}

      {Boolean(error) && !loading && (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      )}

      {!loading && delivery && (
        <>
          {/* Delivery Note / Job Card - Receipt Style */}
          <View style={[styles.receipt, { backgroundColor: '#FFFDF7', borderColor: '#E5E0D0' }]}>
            <View style={styles.receiptHeader}>
              <Ionicons name="document-text" size={32} color="#333" />
              <Text style={styles.receiptTitle}>DELIVERY NOTE</Text>
              <Text style={styles.receiptSubtitle}>Job Card / Waybill</Text>
              <View style={styles.receiptLine} />
            </View>

            <View style={styles.receiptBody}>
              <Text style={styles.rHead}>{delivery.siteName}</Text>
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              <DNRow label="Delivery Note #" value={delivery.jobId} bold />
              <DNRow label="Purchase Order" value={delivery.poNumber} />
              <DNRow label="Date Created" value={formatEAT(delivery.createdAt)} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              <Text style={styles.rSection}>PARTIES</Text>
              <DNRow label="Vendor" value={delivery.vendorName} />
              <DNRow label="Driver" value={delivery.driverName} />
              <DNRow label="Truck" value={delivery.plateNumber} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              <Text style={styles.rSection}>MATERIAL</Text>
              <DNRow label="Material" value={delivery.materialName} />
              <DNRow label="Ordered Qty" value={`${delivery.quantityOrdered} ${delivery.unit || 'tonnes'}`} />
              <DNRow label="Delivered Qty" value={`${delivery.quantityDelivered || 0} ${delivery.unit || 'tonnes'}`} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              <Text style={styles.rSection}>ROUTE</Text>
              <DNRow label="Origin" value={delivery.quarryName} />
              <DNRow label="Destination" value={delivery.siteName} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>

              {netWeight !== null && (
                <>
                  <Text style={styles.rSection}>WEIGHTS</Text>
                  <DNRow label="Weigh-In" value={weighInWt ? `${weighInWt} t` : '—'} />
                  <DNRow label="Weigh-Out" value={weighOutWt ? `${weighOutWt} t` : '—'} />
                  <DNRow label="Net Weight" value={`${netWeight} tonnes`} bold />
                  <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
                </>
              )}

              {/* Status */}
              <View style={[styles.stamp, { backgroundColor: '#FEF3C7', borderColor: '#D97706' }]}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(delivery.status) + '20' },
                ]}>
                  <Text style={[styles.stampText, { color: getStatusColor(delivery.status) }]}>
                    {formatStatus(delivery.status).toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
              <Text style={styles.rBarcode}>||| ||| ||| ||| ||| ||| |||</Text>
              <Text style={styles.rFooter}>Site Operator Confirmation</Text>
              <Text style={styles.rThanks}>Thank you</Text>
            </View>
          </View>

          {/* ============ FULL JOURNEY TIMELINE ============ */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Journey Timeline</Text>
            <View style={[styles.timelineContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {JOURNEY_STEPS.map((step, idx) => {
                const matchingCp = sortedCheckpoints.find(cp => cp.type === step.type);
                const isCompleted = !!matchingCp;
                const isCurrent = !isCompleted && (currentStepIdx === idx - 1);
                const isLast = idx === JOURNEY_STEPS.length - 1;

                // Dot color
                let dotBg = '#CBD5E1'; // gray pending
                let iconName = 'ellipse-outline';
                if (isCompleted) {
                  dotBg = '#16A34A'; // green done
                  iconName = 'checkmark-circle';
                } else if (isCurrent) {
                  dotBg = '#3B82F6'; // blue active
                  iconName = 'time';
                }

                return (
                  <View key={step.type} style={styles.timelineRow}>
                    {/* Dot + Line column */}
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, { backgroundColor: dotBg }]}>
                        {isCompleted && (
                          <Ionicons name="checkmark" size={12} color="#FFF" />
                        )}
                        {isCurrent && (
                          <Ionicons name="ellipse" size={6} color="#FFF" />
                        )}
                      </View>
                      {!isLast && (
                        <View style={[styles.timelineLine, {
                          backgroundColor: isCompleted ? '#16A34A' : '#E2E8F0',
                        }]} />
                      )}
                    </View>

                    {/* Content */}
                    <View style={[
                      styles.timelineContent,
                      { borderColor: isCompleted ? '#16A34A30' : isCurrent ? '#3B82F630' : colors.border },
                      isCurrent && { borderColor: '#3B82F6', borderWidth: 1.5 },
                    ]}>
                      <View style={styles.timelineHeader}>
                        <Ionicons name={step.icon as any} size={16} color={dotBg} />
                        <Text style={[
                          styles.timelineType,
                          {
                            color: isCompleted ? '#16A34A' : isCurrent ? '#3B82F6' : '#94A3B8',
                            fontWeight: isCurrent ? '800' : '600',
                          },
                        ]}>
                          {step.label}
                        </Text>
                        {isCompleted && Boolean(matchingCp?.location) && (
                          <View style={[styles.locationBadge, { backgroundColor: '#16A34A15' }]}>
                            <Text style={styles.locationBadgeText}>{matchingCp.location.split(',')[0]}</Text>
                          </View>
                        )}
                        {isCurrent && (
                          <View style={[styles.currentBadge, { backgroundColor: '#3B82F620' }]}>
                            <Text style={[styles.currentText, { color: '#3B82F6' }]}>ACTIVE</Text>
                          </View>
                        )}
                      </View>

                      {isCompleted && matchingCp && (
                        <>
                          <Text style={[styles.timelineLocation, { color: colors.textSecondary }]}>
                            <Ionicons name="location-outline" size={11} /> {matchingCp.location}
                          </Text>
                          <Text style={[styles.timelineTime, { color: colors.textMuted }]}>
                            <Ionicons name="time-outline" size={11} /> {formatEAT(matchingCp.timestamp)}
                          </Text>
                          {Boolean(matchingCp.notes) && (
                            <Text style={[styles.timelineNotes, { color: colors.textMuted }]}>
                              📝 {matchingCp.notes}
                            </Text>
                          )}
                        </>
                      )}

                      {!isCompleted && isCurrent && (
                        <Text style={[styles.timelinePending, { color: '#3B82F6' }]}>
                          ⏳ Pending — waiting for this step
                        </Text>
                      )}

                      {!isCompleted && !isCurrent && (
                        <Text style={[styles.timelinePending, { color: colors.textMuted }]}>
                          ⏳ Waiting
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Truck & Driver Info Cards */}
          <View style={styles.infoCardsRow}>
            {delivery && (
              <>
                {Boolean(delivery.driverName) && (
                  <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.infoCardHeader}>
                      <Ionicons name="person-circle" size={20} color={NAVY} />
                      <Text style={[styles.infoCardTitle, { color: colors.text }]}>Driver</Text>
                    </View>
                    <Text style={[styles.infoCardValue, { color: colors.text }]}>{delivery.driverName}</Text>
                    {Boolean(delivery.driverPhone) && (
                      <Text style={[styles.infoCardSub, { color: colors.textSecondary }]}>
                        <Ionicons name="call-outline" size={11} /> {delivery.driverPhone}
                      </Text>
                    )}
                  </View>
                )}

                {Boolean(delivery.plateNumber) && (
                  <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.infoCardHeader}>
                      <Ionicons name="car" size={20} color={NAVY} />
                      <Text style={[styles.infoCardTitle, { color: colors.text }]}>Truck</Text>
                    </View>
                    <Text style={[styles.infoCardValue, { color: colors.text }]}>{delivery.plateNumber}</Text>
                    {Boolean(delivery.vehicleModel) && (
                      <Text style={[styles.infoCardSub, { color: colors.textSecondary }]}>
                        {delivery.vehicleModel}
                      </Text>
                    )}
                  </View>
                )}

                {Boolean(delivery.poNumber) && (
                  <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.infoCardHeader}>
                      <Ionicons name="document-text" size={20} color={NAVY} />
                      <Text style={[styles.infoCardTitle, { color: colors.text }]}>Purchase Order</Text>
                    </View>
                    <Text style={[styles.infoCardValue, { color: colors.text }]}>{delivery.poNumber}</Text>
                    {Boolean(delivery.vendorName) && (
                      <Text style={[styles.infoCardSub, { color: colors.textSecondary }]}>
                        {delivery.vendorName}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          {/* All Trips for this Delivery Note */}
          {allTrips.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                All Trips ({allTrips.length})
              </Text>
              {allTrips.map((trip, i) => (
                <View key={trip.id} style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.tripHeader}>
                    <Text style={[styles.tripIndex, { color: NAVY }]}>Trip #{i + 1}</Text>
                    <View style={[styles.tripBadge, { backgroundColor: getStatusColor(trip.status) + '15' }]}>
                      <Text style={[styles.tripBadgeText, { color: getStatusColor(trip.status) }]}>
                        {formatStatus(trip.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.tripDetail, { color: colors.textSecondary }]}>
                    Driver: {trip.driverName} · {trip.plateNumber}
                  </Text>
                  {Boolean(trip.netWeight) && (
                    <Text style={[styles.tripDetail, { color: colors.textSecondary }]}>
                      Net: {trip.netWeight} tonnes
                    </Text>
                  )}
                  <Text style={[styles.tripTime, { color: colors.textMuted }]}>
                    {formatEAT(trip.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Weighments */}
          {weighments.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Weighments</Text>
              {weighments.map((w: any) => (
                <View key={w.id} style={[styles.weighCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.weighHeader}>
                    <Ionicons
                      name={w.type === 'weigh_in' ? 'arrow-down-circle' : 'arrow-up-circle'}
                      size={20} color={w.type === 'weigh_in' ? '#3B82F6' : '#8B5CF6'}
                    />
                    <Text style={[styles.weighType, { color: w.type === 'weigh_in' ? '#3B82F6' : '#8B5CF6' }]}>
                      {w.type === 'weigh_in' ? 'Weigh-In' : 'Weigh-Out'}
                    </Text>
                  </View>
                  <View style={styles.weighBody}>
                    <Text style={[styles.weighValue, { color: colors.text }]}>{w.weight} {w.unit}</Text>
                    <Text style={[styles.weighLocation, { color: colors.textSecondary }]}>{w.location}</Text>
                    <Text style={[styles.weighTime, { color: colors.textMuted }]}>{formatEAT(w.timestamp)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: NAVY }]} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => router.back()}>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {!loading && !delivery && !error && (
        <View style={styles.emptyWrap}>
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Enter a Delivery Note number above to view delivery details
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const DNRow = ({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) => (
  <View style={styles.rRow}>
    <Text style={styles.rLabel}>{label}</Text>
    <Text style={[styles.rValue, bold && { fontWeight: '800' }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 46, gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 14 },
  loadingWrap: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  loadingText: { fontSize: 14, marginTop: Spacing.md },
  errorWrap: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  errorText: { fontSize: 15, marginTop: Spacing.md, textAlign: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  emptyText: { fontSize: 15, marginTop: Spacing.md, textAlign: 'center' },
  // Receipt styles
  receipt: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.xl, marginBottom: Spacing.lg },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptTitle: { fontSize: 16, fontWeight: '800', color: '#333', letterSpacing: 1, marginTop: 4 },
  receiptSubtitle: { fontSize: 10, color: '#999', marginTop: 2 },
  receiptLine: { width: '80%', height: 1, backgroundColor: '#DDD', marginTop: Spacing.sm },
  receiptBody: { padding: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  rDash: { textAlign: 'center', color: '#CCC', marginVertical: 4, fontSize: 11 },
  rSection: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1, marginTop: 4, marginBottom: 2 },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rLabel: { fontSize: 12, color: '#666' },
  rValue: { fontSize: 13, color: '#333' },
  stamp: { alignItems: 'center', paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginVertical: 8 },
  stampText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  statusBadge: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  rBarcode: { textAlign: 'center', fontSize: 14, color: '#333', letterSpacing: 2, marginTop: 8 },
  rFooter: { textAlign: 'center', fontSize: 10, color: '#999', marginTop: 2 },
  rThanks: { textAlign: 'center', fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  // Sections
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  // Timeline
  timelineContainer: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  timelineRow: { flexDirection: 'row', marginBottom: 0 },
  timelineLeft: { alignItems: 'center', width: 30, marginRight: Spacing.sm },
  timelineDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineLine: { width: 2, flex: 1, marginTop: 2, marginBottom: 2 },
  timelineContent: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderColor: '#E2E8F0',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  timelineType: { fontSize: 14 },
  locationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  locationBadgeText: { fontSize: 9, color: '#16A34A', fontWeight: '600' },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  currentText: { fontSize: 9, fontWeight: '700' },
  timelineLocation: { fontSize: 12, marginBottom: 2 },
  timelineTime: { fontSize: 11, marginBottom: 2 },
  timelineNotes: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  timelinePending: { fontSize: 11, fontStyle: 'italic' },
  // Driver/Truck/PO info cards
  infoCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoCardTitle: { fontSize: 11, fontWeight: '700' },
  infoCardValue: { fontSize: 15, fontWeight: '700' },
  infoCardSub: { fontSize: 11, marginTop: 2 },
  // Trips
  tripCard: { borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tripIndex: { fontSize: 13, fontWeight: '700' },
  tripBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  tripBadgeText: { fontSize: 10, fontWeight: '700' },
  tripDetail: { fontSize: 13, marginBottom: 2 },
  tripTime: { fontSize: 11 },
  // Weighments
  weighCard: { borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  weighHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weighType: { fontSize: 13, fontWeight: '700' },
  weighBody: { flex: 1 },
  weighValue: { fontSize: 16, fontWeight: '700' },
  weighLocation: { fontSize: 12 },
  weighTime: { fontSize: 11 },
  // Actions
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  backText: { fontSize: 14, fontWeight: '600' },
});
