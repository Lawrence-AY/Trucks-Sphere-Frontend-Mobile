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
import {
  createDeliveryOrder,
  fetchDeliveryOrders,
  fetchDrivers,
  fetchPurchaseOrders,
  fetchVehicles,
  updateDeliveryOrder,
} from '../../services/api';
import { formatEAT, generateId, generateJobId } from '../../utils/helpers';
import {
  CommandHeader,
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
  StatusPill,
} from '../../components/EnterpriseUI';

export default function OperatorQuarryDashboardScreen() {
  const colors = useTheme();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [poSearch, setPoSearch] = useState('');
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Weight input state for queue items (keyed by delivery order id)
  const [weightInputs, setWeightInputs] = useState<Record<string, { weighIn: string; weighOut: string }>>({});
  const [submittingWeights, setSubmittingWeights] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [data, orders, driverData, vehicleData] = await Promise.all([
        fetchDeliveryOrders(),
        fetchPurchaseOrders(),
        fetchDrivers(),
        fetchVehicles(),
      ]);
      setDeliveries(data || []);
      setPurchaseOrders(orders || []);
      setDrivers(driverData || []);
      setVehicles(vehicleData || []);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Queue = assigned + at_quarry items (not yet completed/delivered/cancelled)
  const queue = deliveries.filter(
    (d) => !['delivered', 'completed', 'cancelled'].includes(d.status),
  );
  const completed = deliveries.filter(
    (d) => d.status === 'delivered' || d.status === 'completed',
  );

  const matchingPurchaseOrders = useMemo(() => {
    const term = poSearch.trim().toLowerCase();
    return purchaseOrders
      .filter((order) =>
        ['approved', 'in_progress', 'pending'].includes(order.status),
      )
      .filter(
        (order) =>
          !term ||
          order.poNumber?.toLowerCase().includes(term) ||
          order.vendorName?.toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [poSearch, purchaseOrders]);

  // Drivers linked to the selected vendor
  const vendorDrivers = useMemo(() => {
    if (!selectedPo) return [];
    return drivers.filter(
      (driver) =>
        driver.vendorId === selectedPo.vendorId && driver.status === 'active',
    );
  }, [drivers, selectedPo]);

  // Vehicles linked to the selected vendor
  const vendorVehicles = useMemo(() => {
    if (!selectedPo) return [];
    return vehicles.filter(
      (vehicle) =>
        vehicle.vendorId === selectedPo.vendorId && vehicle.status === 'active',
    );
  }, [vehicles, selectedPo]);

  const closeAddForm = () => {
    setAddVisible(false);
    setPoSearch('');
    setSelectedPo(null);
    setSelectedDriver(null);
    setSelectedVehicle(null);
    setSubmitting(false);
    setSubmitError('');
  };

  const createQueueJob = async () => {
    if (!selectedPo || !selectedDriver || !selectedVehicle) return;
    const now = new Date().toISOString();
    setSubmitting(true);
    setSubmitError('');
    const payload = {
      id: generateId(),
      jobId: generateJobId(),
      purchaseOrderId: selectedPo.id,
      poNumber: selectedPo.poNumber,
      vendorId: selectedPo.vendorId,
      vendorName: selectedPo.vendorName,
      driverId: selectedDriver.id,
      driverName: selectedDriver.name || selectedDriver.fullName,
      vehicleId: selectedVehicle.id,
      plateNumber: selectedVehicle.plateNumber || selectedVehicle.plate || 'N/A',
      materialId: selectedPo.materialId,
      materialName: selectedPo.materialName,
      quantityOrdered: Math.min(Number(selectedPo.quantity || 20), 20),
      quantityDelivered: 0,
      quarryId: selectedPo.quarryId,
      quarryName: selectedPo.quarryName,
      siteId: selectedPo.siteId,
      siteName: selectedPo.siteName,
      status: 'assigned',
      createdBy: 'operator_quarry',
      createdAt: now,
      updatedAt: now,
    };
    try {
      const createdJob = await createDeliveryOrder(payload);
      setDeliveries((current) => [createdJob, ...current]);
      closeAddForm();
    } catch (error: any) {
      setSubmitError(
        error?.response?.data?.error ||
          error?.message ||
          'Failed to add purchase order to the queue.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getWeightInput = (jobId: string) => {
    return weightInputs[jobId] || { weighIn: '', weighOut: '' };
  };

  const updateWeightInput = (
    jobId: string,
    field: 'weighIn' | 'weighOut',
    value: string,
  ) => {
    setWeightInputs((prev) => ({
      ...prev,
      [jobId]: { ...getWeightInput(jobId), [field]: value },
    }));
  };

  const handleSubmitWeights = (job: any) => {
    const inputs = getWeightInput(job.id);
    const weighIn = parseFloat(inputs.weighIn);
    const weighOut = parseFloat(inputs.weighOut);

    if (isNaN(weighIn) || weighIn <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid Weight In value.');
      return;
    }
    if (isNaN(weighOut) || weighOut <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid Weight Out value.');
      return;
    }
    if (weighOut >= weighIn) {
      Alert.alert(
        'Invalid Weight',
        'Weight Out must be less than Weight In.',
      );
      return;
    }

    const netWeight = weighIn - weighOut;

    Alert.alert(
      'Confirm Submission',
      `Are you sure you want to submit?\n\nJob: ${job.jobId}\nDriver: ${job.driverName}\nPlate: ${job.plateNumber}\nMaterial: ${job.materialName}\nWeight In: ${weighIn.toFixed(1)} tonnes\nWeight Out: ${weighOut.toFixed(1)} tonnes\nNet: ${netWeight.toFixed(1)} tonnes`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            setSubmittingWeights((prev) => ({ ...prev, [job.id]: true }));
            try {
              const now = new Date().toISOString();
              const updated = await updateDeliveryOrder(job.id, {
                weighInWeight: weighIn,
                weighOutWeight: weighOut,
                netWeight,
                weighInAt: now,
                weighOutAt: now,
                weighInLocation: job.quarryName
                  ? `${job.quarryName} Gate`
                  : 'Quarry Gate',
                weighOutLocation: job.quarryName
                  ? `${job.quarryName} Exit`
                  : 'Quarry Exit',
                status: 'loaded',
                updatedAt: now,
              });
              setDeliveries((current) =>
                current.map((item) => (item.id === job.id ? updated : item)),
              );
              // Clear weight inputs for this job
              setWeightInputs((prev) => {
                const next = { ...prev };
                delete next[job.id];
                return next;
              });
            } catch (error: any) {
              Alert.alert(
                'Submission Failed',
                error?.message || 'Could not submit weights.',
              );
            } finally {
              setSubmittingWeights((prev) => ({ ...prev, [job.id]: false }));
            }
          },
        },
      ],
    );
  };

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
        <CommandHeader
          eyebrow="Quarry operations"
          title="Queue"
          subtitle={`${deliveries.length} jobs`}
        />
        <View style={styles.metricRow}>
          <MetricTile
            icon="clipboard"
            label="In queue"
            value={queue.length}
            tone={colors.warning}
          />
          <MetricTile
            icon="checkmark-done"
            label="Completed"
            value={completed.length}
            tone={colors.success}
          />
        </View>

        <SectionTitle title="Active queue" />
        {loading ? (
          <DataCard>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>
              Loading queue...
            </Text>
          </DataCard>
        ) : queue.length ? (
          queue.slice(0, 20).map((item) => {
            const inputs = getWeightInput(item.id);
            const isWeighing = submittingWeights[item.id];
            const hasWeights = item.weighInWeight != null && item.weighOutWeight != null;
            const netFromRecord =
              item.netWeight ?? (hasWeights ? item.weighInWeight - item.weighOutWeight : null);

            return (
              <DataCard
                key={item.id}
                onPress={() =>
                  router.push(
                    `/screens/job-details?id=${item.jobId}` as any,
                  )
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: colors.text,
                    }}
                  >
                    {item.jobId}
                  </Text>
                  <StatusPill status={item.status} compact />
                </View>
                <DetailRow
                  icon="person-outline"
                  value={`${item.driverName || 'Unassigned'} - ${item.plateNumber || 'N/A'}`}
                />
                <DetailRow
                  icon="cube-outline"
                  value={`${item.materialName || 'Material'} - ${item.quantityOrdered || 0} tonnes`}
                />
                <DetailRow
                  icon="business-outline"
                  value={`${item.vendorName || 'N/A'}`}
                />
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textTertiary,
                  }}
                >
                  {formatEAT(item.updatedAt || item.createdAt)}
                </Text>

                {/* Weight input section for items still in "assigned" or "at_quarry" */}
                {!hasWeights ? (
                  <View style={styles.weightSection}>
                    <View style={styles.weightRow}>
                      <View style={styles.weightField}>
                        <Text
                          style={[
                            styles.weightLabel,
                            { color: colors.textMuted },
                          ]}
                        >
                          Weight In (t)
                        </Text>
                        <TextInput
                          style={[
                            styles.weightInput,
                            {
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.inputBg,
                            },
                          ]}
                          placeholder="0.0"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={inputs.weighIn}
                          onChangeText={(value) =>
                            updateWeightInput(item.id, 'weighIn', value)
                          }
                        />
                      </View>
                      <View style={styles.weightField}>
                        <Text
                          style={[
                            styles.weightLabel,
                            { color: colors.textMuted },
                          ]}
                        >
                          Weight Out (t)
                        </Text>
                        <TextInput
                          style={[
                            styles.weightInput,
                            {
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.inputBg,
                            },
                          ]}
                          placeholder="0.0"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="decimal-pad"
                          value={inputs.weighOut}
                          onChangeText={(value) =>
                            updateWeightInput(item.id, 'weighOut', value)
                          }
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.submitWeightBtn,
                        {
                          backgroundColor:
                            inputs.weighIn && inputs.weighOut
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                      onPress={() => handleSubmitWeights(item)}
                      disabled={
                        !inputs.weighIn ||
                        !inputs.weighOut ||
                        isWeighing
                      }
                    >
                      {isWeighing ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color="#FFFFFF"
                        />
                      )}
                      <Text style={styles.submitWeightBtnText}>
                        {isWeighing ? 'Submitting...' : 'Submit'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.weightSubmittedBanner,
                      { backgroundColor: `${colors.success}14`, borderColor: `${colors.success}55` },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.success}
                    />
                    <Text
                      style={[
                        styles.weightSubmittedText,
                        { color: colors.success },
                      ]}
                    >
                      Weighed — In: {item.weighInWeight?.toFixed(1)}t / Out:{' '}
                      {item.weighOutWeight?.toFixed(1)}t / Net:{' '}
                      {netFromRecord?.toFixed(1)}t
                    </Text>
                  </View>
                )}
              </DataCard>
            );
          })
        ) : (
          <EmptyState
            icon="clipboard-outline"
            title="Queue empty"
            subtitle="No active jobs in the quarry queue."
          />
        )}
      </PageShell>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setAddVisible(true)}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Job Modal */}
      <Modal
        visible={addVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAddForm}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.addSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.md }}
            >
              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    Order Lookup
                  </Text>
                  <Text
                    style={[styles.sheetSub, { color: colors.textMuted }]}
                  >
                    Enter an Order Number to prefill details, then assign a
                    driver and vehicle.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.iconButton,
                    { backgroundColor: colors.inputBg },
                  ]}
                  onPress={closeAddForm}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Order Number Lookup */}
              <View
                style={[
                  styles.inputWrap,
                  { borderColor: colors.border, backgroundColor: colors.inputBg },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.poInput, { color: colors.text }]}
                  placeholder="Enter Order Number (e.g. PO-2026-001)"
                  placeholderTextColor={colors.textTertiary}
                  value={selectedPo ? selectedPo.poNumber : poSearch}
                  onChangeText={(value) => {
                    setPoSearch(value);
                    setSelectedPo(null);
                    setSelectedDriver(null);
                    setSelectedVehicle(null);
                  }}
                />
              </View>

              {/* PO Suggestions */}
              {!selectedPo ? (
                <View style={styles.optionList}>
                  {matchingPurchaseOrders.map((order) => (
                    <TouchableOpacity
                      key={order.id}
                      style={[
                        styles.optionRow,
                        { borderColor: colors.border },
                      ]}
                      onPress={() => {
                        setSelectedPo(order);
                        setPoSearch(order.poNumber);
                        setSelectedDriver(null);
                        setSelectedVehicle(null);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionTitle,
                            { color: colors.text },
                          ]}
                        >
                          {order.poNumber}
                        </Text>
                        <Text
                          style={[
                            styles.optionMeta,
                            { color: colors.textMuted },
                          ]}
                        >
                          {order.vendorName}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                /* Prefilled Order Details */
                <View style={styles.selectedBlock}>
                  <Text
                    style={[
                      styles.prefillSectionTitle,
                      { color: colors.text },
                    ]}
                  >
                    Order Details
                  </Text>
                  <DetailRow
                    icon="document-outline"
                    value={`Order: ${selectedPo.poNumber}`}
                  />
                  <DetailRow
                    icon="business-outline"
                    value={`Vendor: ${selectedPo.vendorName}`}
                  />
                  <DetailRow
                    icon="cube-outline"
                    value={`Material: ${selectedPo.materialName} - ${selectedPo.quantity} ${selectedPo.unit}`}
                  />
                  <DetailRow
                    icon="location-outline"
                    value={`Quarry: ${selectedPo.quarryName}`}
                  />
                  <DetailRow
                    icon="flag-outline"
                    value={`Site: ${selectedPo.siteName}`}
                  />
                  <DetailRow
                    icon="cash-outline"
                    value={`Unit Price: KES ${Number(selectedPo.unitPrice).toLocaleString()}`}
                  />
                </View>
              )}

              {/* Driver Selection */}
              {selectedPo ? (
                <>
                  <Text style={[styles.driverLabel, { color: colors.text }]}>
                    Select Driver
                  </Text>
                  <View style={styles.optionList}>
                    {vendorDrivers.length ? (
                      vendorDrivers.map((driver) => {
                        const active = selectedDriver?.id === driver.id;
                        return (
                          <TouchableOpacity
                            key={driver.id}
                            style={[
                              styles.driverRow,
                              {
                                borderColor: active
                                  ? colors.primary
                                  : colors.border,
                                backgroundColor: active
                                  ? `${colors.primary}10`
                                  : colors.surface,
                              },
                            ]}
                            onPress={() => setSelectedDriver(driver)}
                          >
                            <Ionicons
                              name={
                                active
                                  ? 'radio-button-on'
                                  : 'radio-button-off'
                              }
                              size={18}
                              color={
                                active
                                  ? colors.primary
                                  : colors.textMuted
                              }
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.optionTitle,
                                  { color: colors.text },
                                ]}
                              >
                                {driver.name || driver.fullName}
                              </Text>
                              <Text
                                style={[
                                  styles.optionMeta,
                                  { color: colors.textMuted },
                                ]}
                              >
                                License: {driver.licenseNumber}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text
                        style={[
                          styles.emptyDrivers,
                          { color: colors.textMuted },
                        ]}
                      >
                        No active drivers for this vendor.
                      </Text>
                    )}
                  </View>
                </>
              ) : null}

              {/* Vehicle Selection */}
              {selectedPo ? (
                <>
                  <Text style={[styles.driverLabel, { color: colors.text }]}>
                    Select Vehicle (Number Plate)
                  </Text>
                  <View style={styles.optionList}>
                    {vendorVehicles.length ? (
                      vendorVehicles.map((vehicle) => {
                        const active = selectedVehicle?.id === vehicle.id;
                        return (
                          <TouchableOpacity
                            key={vehicle.id}
                            style={[
                              styles.driverRow,
                              {
                                borderColor: active
                                  ? colors.primary
                                  : colors.border,
                                backgroundColor: active
                                  ? `${colors.primary}10`
                                  : colors.surface,
                              },
                            ]}
                            onPress={() => setSelectedVehicle(vehicle)}
                          >
                            <Ionicons
                              name={
                                active
                                  ? 'radio-button-on'
                                  : 'radio-button-off'
                              }
                              size={18}
                              color={
                                active
                                  ? colors.primary
                                  : colors.textMuted
                              }
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.optionTitle,
                                  { color: colors.text },
                                ]}
                              >
                                {vehicle.plateNumber || vehicle.plate}
                              </Text>
                              <Text
                                style={[
                                  styles.optionMeta,
                                  { color: colors.textMuted },
                                ]}
                              >
                                {vehicle.make} {vehicle.model} ({vehicle.capacity}t)
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text
                        style={[
                          styles.emptyDrivers,
                          { color: colors.textMuted },
                        ]}
                      >
                        No active vehicles for this vendor.
                      </Text>
                    )}
                  </View>
                </>
              ) : null}

              {/* Submit Error */}
              {submitError ? (
                <Text
                  style={[styles.submitError, { color: colors.danger }]}
                >
                  {submitError}
                </Text>
              ) : null}

              {/* Add Queue Button */}
              <TouchableOpacity
                style={[
                  styles.createBtn,
                  {
                    backgroundColor:
                      selectedPo &&
                      selectedDriver &&
                      selectedVehicle &&
                      !submitting
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={createQueueJob}
                disabled={
                  !selectedPo ||
                  !selectedDriver ||
                  !selectedVehicle ||
                  submitting
                }
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons
                    name="add-circle-outline"
                    size={19}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.createBtnText}>
                  {submitting ? 'Adding...' : 'Add to Queue'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  addSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  poInput: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
  optionList: { gap: Spacing.sm },
  optionRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionTitle: { fontSize: 14, fontWeight: '900' },
  optionMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  prefillSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedBlock: { gap: Spacing.sm },
  driverLabel: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: Spacing.xs,
  },
  driverRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyDrivers: {
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: Spacing.md,
  },
  submitError: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  createBtn: {
    minHeight: 50,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  createBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  // Weight input styles
  weightSection: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  weightRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  weightField: {
    flex: 1,
    gap: 4,
  },
  weightLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  weightInput: {
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontWeight: '700',
  },
  submitWeightBtn: {
    minHeight: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  submitWeightBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  weightSubmittedBanner: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weightSubmittedText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
});