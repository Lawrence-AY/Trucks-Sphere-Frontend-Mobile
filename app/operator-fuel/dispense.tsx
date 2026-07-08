import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import {
  fetchDeliveryOrders,
  createFuelRecord,
  fetchFuelRecords,
  fetchVendors,
  requestFuelAuthorization,
  verifyFuelAuthorization,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { formatEAT, generateFuelRecordId } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
} from '../../components/EnterpriseUI';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FlowStep = 'list' | 'authorization' | 'form';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Sequential fuel counter per job (in-memory)
const fuelSeqMap: Record<string, number> = {};
function nextFuelSeq(key: string): number {
  if (!fuelSeqMap[key]) fuelSeqMap[key] = 0;
  fuelSeqMap[key]++;
  return fuelSeqMap[key];
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function FuelDispenseScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeJob, setActiveJob] = useState<any>(null);
  const [fuelAmount, setFuelAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Flow modal state
  const [flowStep, setFlowStep] = useState<FlowStep>('list');
  const [flowVisible, setFlowVisible] = useState(false);
  const [flowFuelAmount, setFlowFuelAmount] = useState('');

  // Authorization state
  const [authId, setAuthId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string>('pending');
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [authVerifying, setAuthVerifying] = useState(false);

  // Fuel price from management
  const [fuelPrice, setFuelPrice] = useState<number>(0);

  // Vendors lookup for phone numbers (delivery orders don't carry vendorPhone)
  const [vendorsMap, setVendorsMap] = useState<Record<string, any>>({});

  // ============================ Data Fetching ==============================

  const loadData = async (silent?: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const [deliveryData, fuelData, vendorData] = await Promise.all([
        fetchDeliveryOrders(),
        fetchFuelRecords(),
        fetchVendors(),
      ]);
      setDeliveries((deliveryData || []).filter((d: any) =>
        !['completed', 'delivered', 'cancelled'].includes(d.status)
      ));
      setFuelRecords(fuelData || []);
      // Build vendors lookup map by ID for phone resolution
      const map: Record<string, any> = {};
      (vendorData || []).forEach((v: any) => {
        if (v.id) map[v.id] = v;
        if (v.vendorId) map[v.vendorId] = v;
      });
      setVendorsMap(map);
    } catch {} finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const loadFuelPrice = async () => {
    try {
      setFuelPrice(0);
    } catch {
      setFuelPrice(0);
    }
  };

  useEffect(() => { loadData(); loadFuelPrice(); }, []);

  // ========================= Derived Lists ================================

  const getJobFuelAmount = (jobId: string): number =>
    fuelRecords.filter((f) => f.jobId === jobId).reduce((s, f) => s + (f.fuelAmount || 0), 0);

  const activeDeliveries = useMemo(() => {
    return deliveries.filter((d) =>
      !['completed', 'delivered', 'received', 'cancelled'].includes(d.status)
    );
  }, [deliveries]);

  // =========================== FAB Flow ===================================

  const openFlow = () => {
    setFlowStep('list');
    setFlowVisible(true);
    setFlowFuelAmount('');
    setActiveJob(null);
    setAuthId(null);
    setAuthStatus('pending');
    setOtpInput('');
    setOtpModalVisible(false);
    setAuthVerifying(false);
    loadData(); // refresh active jobs
  };

  const closeFlow = () => {
    setFlowVisible(false);
    setFlowStep('list');
    setOtpModalVisible(false);
    setOtpInput('');
  };

  // Select an active job from the list
  const handleSelectJob = (job: any) => {
    setActiveJob(job);
    setFlowFuelAmount('');
    // Auto-request authorization immediately after selecting job
    setFlowStep('authorization');
  };

  // Request authorization from vendor (no fuel amount yet)
  const handleRequestAuthorization = async () => {
    if (!activeJob) {
      Alert.alert('Error', 'No active job selected.');
      return;
    }

    // Resolve vendor phone from the vendors lookup map (delivery orders don't carry vendorPhone)
    const vendor = vendorsMap[activeJob.vendorId];
    const vendorPhone = vendor?.phone || vendor?.mobile || activeJob.vendorPhone || '';
    const driverPhone = activeJob.driverPhone || '';

    if (!vendorPhone) {
      Alert.alert('Missing Vendor Phone', 'This job does not have a linked vendor phone number for the OTP.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestFuelAuthorization({
        vendorId: activeJob.vendorId,
        vendorName: activeJob.vendorName || 'Unknown Vendor',
        vendorPhone,
        driverId: activeJob.driverId,
        driverName: activeJob.driverName || 'Unknown Driver',
        driverPhone,
        vehicleId: activeJob.vehicleId || activeJob.id,
        plateNumber: activeJob.plateNumber || 'N/A',
        fuelAmount: 0, // Amount will be entered after authorization
        jobId: activeJob.jobId || activeJob.id,
      });

      if (!result?.id) {
        throw new Error('Authorization request was not created. Please try again.');
      }

      setAuthId(result.id);
      setAuthStatus('pending');
      setOtpInput('');
      setOtpModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to request authorization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpInput.trim();
    if (!authId) {
      Alert.alert('Error', 'No active authorization request.');
      return;
    }
    if (!code) {
      Alert.alert('Missing OTP', 'Enter the OTP sent to the linked vendor.');
      return;
    }
    if (code.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the full OTP code.');
      return;
    }

    setAuthVerifying(true);
    try {
      const result = await verifyFuelAuthorization(authId, code, true);
      if (result?.status !== 'authorized' && result?.authorized !== true) {
        throw new Error(result?.message || 'OTP verification failed.');
      }

      setAuthStatus('authorized');
      setOtpModalVisible(false);
      setOtpInput('');
      Alert.alert('Authorized', 'OTP verified. You can now dispense fuel.', [
        { text: 'Enter Fuel Amount', onPress: () => setFlowStep('form') }
      ]);
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Invalid OTP. Please try again.';
      Alert.alert('Verification Failed', message);
    } finally {
      setAuthVerifying(false);
    }
  };

  // After authorization, enter fuel amount and dispense
  const handleFlowSubmit = async () => {
    const amount = parseFloat(flowFuelAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid fuel amount.');
      return;
    }
    if (!activeJob) {
      Alert.alert('Error', 'No active job selected.');
      return;
    }

    if (authStatus !== 'authorized') {
      Alert.alert('Not Authorized', 'Vendor authorization is required before dispensing fuel.');
      return;
    }

    setSubmitting(true);
    try {
      const jobId = activeJob.jobId || activeJob.id;
      const fuelId = generateFuelRecordId(jobId);

      await createFuelRecord({
        fuelId,
        jobId,
        deliveryOrderId: activeJob.id,
        driverId: activeJob.driverId,
        driverName: activeJob.driverName || 'N/A',
        plateNumber: activeJob.plateNumber || 'N/A',
        vendorId: activeJob.vendorId,
        vendorName: activeJob.vendorName || 'N/A',
        materialName: activeJob.materialName || 'N/A',
        fuelAmount: amount,
        pricePerLiter: fuelPrice,
        totalCost: fuelPrice > 0 ? amount * fuelPrice : 0,
        unit: 'Litres',
        dispensedBy: user?.email || 'Fuel Operator',
        dispensedByEmail: user?.email || '',
        dispensedByName: user?.displayName || user?.name || 'Fuel Operator',
        dispensedAt: new Date().toISOString(),
        authorizationId: authId,
      });

      Alert.alert('Fuel Dispensed', `${amount.toFixed(1)} litres recorded as ${fuelId}.`, [
        { text: 'OK', onPress: () => { closeFlow(); loadData(); } }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to record fuel');
    } finally {
      setSubmitting(false);
    }
  };

  // Driver photo URL helper
  const getDriverPhotoUrl = (driver: any): string | undefined => {
    return driver?.photoURL || driver?.profilePicture || driver?.photoUrl || undefined;
  };

  // ======================== Render: Main Screen ============================

  return (
    <View style={{ flex: 1 }}>
      <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
        <Text style={{ color: colors.textMuted }}>
          Press the + button to select an active job and dispense fuel
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
          Fuel price is managed by Management
        </Text>
        {loading ? (
          <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>
        ) : activeDeliveries.length ? (
          <DataCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Ionicons name="document-text-outline" size={18} color="#F59E0B" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {activeDeliveries.length} active job{activeDeliveries.length !== 1 ? 's' : ''} available
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
              Tap the + button to view and dispense fuel
            </Text>
          </DataCard>
        ) : (
          <EmptyState icon="water-outline" title="No active jobs" subtitle="No active delivery orders available for fuel dispensing." />
        )}
      </PageShell>

      {/* FAB Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: '#F59E0B' }]}
        onPress={openFlow}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Flow Modal */}
      <Modal visible={flowVisible} transparent animationType="slide" onRequestClose={closeFlow}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.flowSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.flowHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {flowStep === 'list' ? 'Active Jobs' : flowStep === 'authorization' ? 'Vendor Authorization' : 'Dispense Fuel'}
                </Text>
                <Text style={[styles.sheetSub, { color: colors.textMuted }]} numberOfLines={2}>
                  {flowStep === 'list'
                    ? 'Select an active job to dispense fuel'
                    : flowStep === 'authorization'
                      ? `Job: ${activeJob?.jobId || activeJob?.id || 'N/A'}`
                      : `Job: ${activeJob?.jobId || activeJob?.id || 'N/A'}  ·  Driver: ${activeJob?.driverName || 'N/A'}  ·  Truck: ${activeJob?.plateNumber || 'N/A'}`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: colors.inputBg }]}
                onPress={closeFlow}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Step indicators */}
            <View style={styles.stepRow}>
              {(['list', 'authorization', 'form'] as FlowStep[]).map((s, idx) => {
                const steps: FlowStep[] = ['list', 'authorization', 'form'];
                const currentIdx = steps.indexOf(flowStep);
                const stepIdx = steps.indexOf(s);
                const completed = stepIdx < currentIdx;
                const isCurrent = stepIdx === currentIdx;
                let dotColor = colors.border;
                if (completed) dotColor = '#10B981';
                else if (isCurrent) dotColor = '#F59E0B';
                let lineColor = colors.border;
                if (stepIdx < 2 && stepIdx < currentIdx) lineColor = '#10B981';
                return (
                  <React.Fragment key={s}>
                    <View style={[styles.stepDot, { backgroundColor: dotColor }]} />
                    {stepIdx < 2 && <View style={[styles.stepLine, { backgroundColor: lineColor }]} />}
                  </React.Fragment>
                );
              })}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.md }}
              keyboardShouldPersistTaps="handled"
            >
              {/* ============ STEP 1: Active Jobs List ============ */}
              {flowStep === 'list' && (
                <>
                  {activeDeliveries.length ? activeDeliveries.map((job) => {
                    const existingFuel = getJobFuelAmount(job.jobId || job.id);
                    return (
                      <TouchableOpacity
                        key={job.id}
                        style={[styles.jobSelectCard, { borderColor: colors.border }]}
                        onPress={() => handleSelectJob(job)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.selectIconCircle, { backgroundColor: '#F59E0B15' }]}>
                          <Ionicons name="document-text-outline" size={20} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectTitle, { color: colors.text }]}>
                            {job.jobId || job.id}
                          </Text>
                          <Text style={[styles.selectSub, { color: colors.textMuted }]}>
                            Driver: {job.driverName || 'N/A'} · {job.plateNumber || 'N/A'}
                          </Text>
                          <Text style={[styles.selectSub, { color: colors.textMuted }]}>
                            Vendor: {job.vendorName || 'N/A'} · Material: {job.materialName || 'N/A'}
                          </Text>
                          {existingFuel > 0 && (
                            <View style={[styles.fuelChip, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' }]}>
                              <Ionicons name="water" size={12} color="#F59E0B" />
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B' }}>
                                {existingFuel.toFixed(1)} L already dispensed
                              </Text>
                            </View>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                      </TouchableOpacity>
                    );
                  }) : (
                    <EmptyState icon="document-text-outline" title="No active jobs" subtitle="No active delivery orders available." />
                  )}
                </>
              )}

              {/* ============ STEP 2: Authorization ============ */}
              {flowStep === 'authorization' && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <TouchableOpacity
                      style={[styles.backBtn, { borderColor: colors.border }]}
                      onPress={() => {
                        setFlowStep('list');
                        setOtpModalVisible(false);
                        setOtpInput('');
                      }}
                    >
                      <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                      <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
                    </TouchableOpacity>
                    <View style={[styles.chip, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }]}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>
                        {activeJob?.jobId || activeJob?.id || 'Job'}
                      </Text>
                    </View>
                  </View>

                  {/* Selected job summary */}
                  {activeJob && (
                    <View style={[styles.jobSummaryCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      {/* Driver info with photo */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                        {getDriverPhotoUrl(activeJob) ? (
                          <Image source={{ uri: getDriverPhotoUrl(activeJob) }} style={styles.driverPhotoLarge} />
                        ) : (
                          <View style={[styles.driverPhotoLarge, { backgroundColor: '#3B82F615', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="person" size={32} color="#3B82F6" />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectTitle, { color: colors.text }]}>
                            {activeJob.driverName || 'Unknown Driver'}
                          </Text>
                          <Text style={[styles.selectSub, { color: colors.textMuted }]}>
                            {activeJob.plateNumber || 'N/A'}
                          </Text>
                          <Text style={[styles.selectSub, { color: colors.textMuted }]}>
                            {activeJob.vendorName || 'Unknown Vendor'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Authorization status display */}
                  <View style={[styles.authStatusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={{ alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.xl }}>
                      {authStatus === 'pending' ? (
                        <>
                          <View style={[styles.authIconCircle, { backgroundColor: '#F59E0B15' }]}>
                            <Ionicons name="key-outline" size={48} color="#F59E0B" />
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                            Request Vendor OTP
                          </Text>
                          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                            Send an OTP to the linked vendor, then enter the code here to verify fuel dispensing.
                          </Text>
                          {authId ? (
                            <TouchableOpacity
                              style={[styles.submitBtn, { backgroundColor: '#F59E0B' }]}
                              onPress={() => setOtpModalVisible(true)}
                            >
                              <Ionicons name="keypad-outline" size={20} color="#FFFFFF" />
                              <Text style={styles.submitBtnText}>Enter OTP</Text>
                            </TouchableOpacity>
                          ) : null}
                        </>
                      ) : authStatus === 'authorized' ? (
                        <>
                          <View style={[styles.authIconCircle, { backgroundColor: '#10B98115' }]}>
                            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: '#10B981', textAlign: 'center' }}>
                            Authorized!
                          </Text>
                          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                            The vendor has authorized fuel dispensing. Please enter fuel amount below.
                          </Text>
                          <TouchableOpacity
                            style={[styles.submitBtn, { backgroundColor: '#10B981' }]}
                            onPress={() => setFlowStep('form')}
                          >
                            <Ionicons name="water-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.submitBtnText}>Enter Fuel Amount</Text>
                          </TouchableOpacity>
                        </>
                      ) : authStatus === 'denied' ? (
                        <>
                          <View style={[styles.authIconCircle, { backgroundColor: '#EF444415' }]}>
                            <Ionicons name="close-circle" size={48} color="#EF4444" />
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: '#EF4444', textAlign: 'center' }}>
                            Authorization Denied
                          </Text>
                          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                            The vendor has denied this fuel dispensing request.
                          </Text>
                          <TouchableOpacity
                            style={[styles.submitBtn, { backgroundColor: '#3B82F6' }]}
                            onPress={() => { setAuthId(null); setAuthStatus('pending'); setFlowStep('list'); }}
                          >
                            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                            <Text style={styles.submitBtnText}>Back to Jobs</Text>
                          </TouchableOpacity>
                        </>
                      ) : authStatus === 'expired' ? (
                        <>
                          <View style={[styles.authIconCircle, { backgroundColor: '#94A3B815' }]}>
                            <Ionicons name="time-outline" size={48} color="#94A3B8" />
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: '#94A3B8', textAlign: 'center' }}>
                            OTP Expired
                          </Text>
                          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                            The OTP has expired. Please select a job and request a new authorization.
                          </Text>
                          <TouchableOpacity
                            style={[styles.submitBtn, { backgroundColor: '#3B82F6' }]}
                            onPress={() => { setAuthId(null); setAuthStatus('pending'); setFlowStep('list'); }}
                          >
                            <Ionicons name="refresh" size={20} color="#FFFFFF" />
                            <Text style={styles.submitBtnText}>Back to Jobs</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}

                      {/* Initial request button (only when not yet requested) */}
                      {!authId && authStatus === 'pending' && (
                        <TouchableOpacity
                          style={[styles.submitBtn, { backgroundColor: '#3B82F6' }]}
                          onPress={handleRequestAuthorization}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Ionicons name="key-outline" size={20} color="#FFFFFF" />
                          )}
                          <Text style={styles.submitBtnText}>
                            {submitting ? 'Requesting...' : 'Request Authorization'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </>
              )}

              {/* ============ STEP 3: Fuel Amount Form ============ */}
              {flowStep === 'form' && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={[styles.backBtn, { borderColor: colors.border }]}
                      onPress={() => setFlowStep('authorization')}
                    >
                      <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                      <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
                    </TouchableOpacity>
                    <View style={[styles.chip, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>Authorized ✓</Text>
                    </View>
                  </View>

                  {/* Driver info card */}
                  {activeJob && (
                    <View style={[styles.driverInfoCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                        {getDriverPhotoUrl(activeJob) ? (
                          <Image source={{ uri: getDriverPhotoUrl(activeJob) }} style={styles.driverPhotoLarge} />
                        ) : (
                          <View style={[styles.driverPhotoLarge, { backgroundColor: '#3B82F615', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="person" size={32} color="#3B82F6" />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectTitle, { color: colors.text }]}>
                            {activeJob.driverName || 'Unknown Driver'}
                          </Text>
                          <Text style={[styles.selectSub, { color: colors.textMuted }]}>
                            ID: {activeJob.driverId} · {activeJob.plateNumber || 'N/A'}
                          </Text>
                          <Text style={[styles.selectSub, { color: colors.textMuted }]}>
                            Job: {activeJob.jobId || activeJob.id}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Fuel amount input */}
                  <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.inputHeader}>
                      <View style={[styles.inputIcon, { backgroundColor: '#F59E0B15' }]}>
                        <Ionicons name="water-outline" size={22} color="#F59E0B" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputTitle, { color: colors.text }]}>Fuel Amount</Text>
                        <Text style={[styles.inputSub, { color: colors.textMuted }]}>
                          Enter fuel amount in litres.
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.fuelInputWrap, { borderColor: '#F59E0B', backgroundColor: colors.inputBg }]}>
                      <TextInput
                        style={[styles.fuelInput, { color: colors.text }]}
                        placeholder="0.0"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        value={flowFuelAmount}
                        onChangeText={setFlowFuelAmount}
                        autoFocus
                      />
                      <Text style={[styles.fuelSuffix, { color: colors.textMuted }]}>Litres</Text>
                    </View>
                  </View>

                  {/* Fuel price info */}
                  <View style={[styles.priceInfoCard, { backgroundColor: '#10B98110', borderColor: '#10B98120' }]}>
                    <Ionicons name="information-circle-outline" size={18} color="#10B981" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#10B981', flex: 1 }}>
                      Fuel Price (managed by Management): KES {fuelPrice.toFixed(2)}/L
                    </Text>
                  </View>

                  {flowFuelAmount && fuelPrice > 0 ? (
                    <View style={{ marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Total Cost:</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>
                        KES {(parseFloat(flowFuelAmount) * fuelPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                  ) : null}

                  {/* Existing fuel dispensed for this job */}
                  {activeJob && (() => {
                    const existingFuel = getJobFuelAmount(activeJob.jobId || activeJob.id);
                    return existingFuel > 0 ? (
                      <View style={[styles.existingFuel, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' }]}>
                        <Ionicons name="water" size={16} color="#F59E0B" />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>
                          {existingFuel.toFixed(1)} L already dispensed for this job
                        </Text>
                      </View>
                    ) : null;
                  })()}

                  {/* Submit button */}
                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: flowFuelAmount && !submitting ? '#F59E0B' : colors.border }]}
                    onPress={handleFlowSubmit}
                    disabled={submitting || !flowFuelAmount || parseFloat(flowFuelAmount) <= 0}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    )}
                    <Text style={styles.submitBtnText}>
                      {submitting ? 'Dispensing...' : 'Dispense Fuel'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* OTP Verification Popup */}
      <Modal visible={otpModalVisible} transparent animationType="fade" onRequestClose={() => setOtpModalVisible(false)}>
        <View style={styles.otpBackdrop}>
          <View style={[styles.otpCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.authIconCircle, { backgroundColor: '#F59E0B15', alignSelf: 'center' }]}>
              <Ionicons name="keypad-outline" size={42} color="#F59E0B" />
            </View>
            <Text style={[styles.otpTitle, { color: colors.text }]}>Enter Vendor OTP</Text>
            <Text style={[styles.otpSub, { color: colors.textMuted }]}>
              Ask the linked vendor for the OTP sent to their phone, then enter it to verify this fuel dispense.
            </Text>
            <TextInput
              style={[styles.otpInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
              placeholder="6-digit OTP"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={otpInput}
              onChangeText={(value) => setOtpInput(value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
            />
            <View style={styles.otpActions}>
              <TouchableOpacity
                style={[styles.otpSecondaryBtn, { borderColor: colors.border }]}
                onPress={() => setOtpModalVisible(false)}
                disabled={authVerifying}
              >
                <Text style={[styles.otpSecondaryText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.otpPrimaryBtn, { backgroundColor: otpInput.trim() && !authVerifying ? '#10B981' : colors.border }]}
                onPress={handleVerifyOtp}
                disabled={authVerifying || !otpInput.trim()}
              >
                {authVerifying ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.otpPrimaryText}>{authVerifying ? 'Verifying...' : 'Verify'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ================================ Styles =====================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  formContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },

  // Job selection cards (in list step)
  jobSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  selectIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectTitle: { fontSize: 15, fontWeight: '700' },
  selectSub: { fontSize: 12, marginTop: 2 },
  fuelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 6,
  },

  // Input card
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  inputIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputTitle: { fontSize: 16, fontWeight: '700' },
  inputSub: { fontSize: 12, marginTop: 2 },
  fuelInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 64, flexDirection: 'row', alignItems: 'center' },
  fuelInput: { flex: 1, fontSize: 28, fontWeight: '800' },
  fuelSuffix: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },

  // Buttons
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    minHeight: 50,
    marginTop: Spacing.sm,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  backText: { fontSize: 13, fontWeight: '600' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },

  // Driver info
  driverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  driverPhotoLarge: { width: 56, height: 56, borderRadius: 28 },
  jobSummaryCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },

  // Price info
  priceInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  existingFuel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },

  // Authorization
  authStatusCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg },
  authIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    zIndex: 100,
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  flowSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  flowHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  iconButton: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },

  // Step dots
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, gap: 0 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepLine: { width: 48, height: 3, borderRadius: 2 },

  // OTP popup
  otpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  otpCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  otpTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  otpSub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  otpInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    height: 54,
    paddingHorizontal: Spacing.md,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 3,
  },
  otpActions: { flexDirection: 'row', gap: Spacing.sm },
  otpSecondaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpSecondaryText: { fontSize: 14, fontWeight: '800' },
  otpPrimaryBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  otpPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
