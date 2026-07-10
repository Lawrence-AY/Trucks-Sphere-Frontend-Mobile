import { useEffect, useMemo, useState } from 'react';
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
import { useAuthStore } from '../../store/authStore';
import { formatEAT, generateId, generateJobId } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SearchField,
  SectionTitle,
  
} from '../../components/EnterpriseUI';
import DriverProfileModal from '../../components/DriverProfileModal';

/* ─────────── Phase 1: Schedule Tab — Site Weight In ─────────── */

export default function OperatorSiteDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [allDrivers, setAllDrivers] = useState<any[]>([]);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ─── Weight In form state (per job) ───
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [weightInInputs, setWeightInInputs] = useState<Record<string, string>>({});
  const [lotInputs, setLotInputs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});

  // ─── Success modal for Phase 1 completion ───
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successJob, setSuccessJob] = useState<any>(null);

  // Driver lookup map for resolving photoURL
  const [driverMap, setDriverMap] = useState<Record<string, any>>({});

  // Driver profile modal state
  const [driverProfileVisible, setDriverProfileVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedDriverData, setSelectedDriverData] = useState<any>(null);

  // ─── FAB / Unscheduled Arrival modal state ───
  const [fabVisible, setFabVisible] = useState(false);
  const [fabPoSearch, setFabPoSearch] = useState('');
  const [fabSelectedPo, setFabSelectedPo] = useState<any>(null);
  const [fabSelectedDriver, setFabSelectedDriver] = useState<any>(null);
  const [fabSelectedVehicle, setFabSelectedVehicle] = useState<any>(null);
  const [fabIsCustomDriver, setFabIsCustomDriver] = useState(false);
  const [fabCustomDriverName, setFabCustomDriverName] = useState('');
  const [fabCustomLicense, setFabCustomLicense] = useState('');
  const [fabIsCustomVehicle, setFabIsCustomVehicle] = useState(false);
  const [fabCustomPlate, setFabCustomPlate] = useState('');
  const [fabWeightIn, setFabWeightIn] = useState('');
  const [fabLotNumber, setFabLotNumber] = useState('');
  const [fabSubmitting, setFabSubmitting] = useState(false);
  const [fabSubmitError, setFabSubmitError] = useState('');

  const loadData = async (silent?: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const [data, driverData, orders, vehicleData] = await Promise.all([
        fetchDeliveryOrders(),
        fetchDrivers(),
        fetchPurchaseOrders(),
        fetchVehicles(),
      ]);
      setDeliveries(data || []);
      setPurchaseOrders(orders || []);
      setAllDrivers(driverData || []);
      setAllVehicles(vehicleData || []);
      // Build driver lookup map
      const map: Record<string, any> = {};
      (driverData || []).forEach((d: any) => { if (d.id) map[d.id] = d; });
      setDriverMap(map);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  /* ─── Filtered & categorized data ─── */

  // Only show trucks that have been weighed at quarry (weighIn + weighOut weight recorded)
  // and have NOT been weighed in at site yet — once weighed in, they move to Weights tab
  const allScheduled = useMemo(
    () => deliveries.filter((d) => {
      if (['cancelled', 'delivered', 'weighed_in', 'completed'].includes(d.status)) return false;
      if (d.siteWeighInWeight != null) return false; // already weighed in — move off schedule
      // Must have been weighed at quarry (has both weigh in and weigh out weights)
      return d.weighInWeight != null && d.weighOutWeight != null;
    }),
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

  const getLotInput = (jobId: string): string => {
    return lotInputs[jobId] || '';
  };

  const setLotInput = (jobId: string, value: string) => {
    setLotInputs((prev) => ({ ...prev, [jobId]: value }));
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

   
    const expected = job.quantityOrdered || 0;
    if (weightInNum < expected * 0.3) {
      Alert.alert(
        'Low Weight Warning',
        `The Site Arrival Weight (${weightInNum.toFixed(1)}T) Do you want to proceed?`,
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

      // Clear inputs
      setWeightInInputs((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      setLotInputs((prev) => {
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

  /* ─── FAB: Unscheduled Arrival Handlers ─── */

  const fabMatchingPOs = useMemo(() => {
    const term = fabPoSearch.trim().toLowerCase();
    return purchaseOrders
      .filter((order) => ['approved', 'pending', 'in_progress'].includes(order.status))
      .filter(
        (order) =>
          !term ||
          order.poNumber?.toLowerCase().includes(term) ||
          order.vendorName?.toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [fabPoSearch, purchaseOrders]);

  const fabVendorDrivers = useMemo(() => {
    if (!fabSelectedPo) return [];
    return allDrivers.filter(
      (driver) => driver.vendorId === fabSelectedPo.vendorId && driver.status === 'active',
    );
  }, [allDrivers, fabSelectedPo]);

  const fabVendorVehicles = useMemo(() => {
    if (!fabSelectedPo) return [];
    return allVehicles.filter(
      (vehicle) => vehicle.vendorId === fabSelectedPo.vendorId && vehicle.status === 'active',
    );
  }, [allVehicles, fabSelectedPo]);

  const closeFab = () => {
    setFabVisible(false);
    setFabPoSearch('');
    setFabSelectedPo(null);
    setFabSelectedDriver(null);
    setFabSelectedVehicle(null);
    setFabIsCustomDriver(false);
    setFabCustomDriverName('');
    setFabCustomLicense('');
    setFabIsCustomVehicle(false);
    setFabCustomPlate('');
    setFabWeightIn('');
    setFabLotNumber('');
    setFabSubmitting(false);
    setFabSubmitError('');
  };

  const handleFabSubmit = async () => {
    if (!fabSelectedPo) return;
    const weightInNum = parseFloat(fabWeightIn);
    if (isNaN(weightInNum) || weightInNum <= 0) return;
    if (!fabLotNumber.trim()) return;
    const hasValidDriver = fabIsCustomDriver ? (fabCustomDriverName.trim() && fabCustomLicense.trim()) : !!fabSelectedDriver;
    const hasValidVehicle = fabIsCustomVehicle ? !!fabCustomPlate.trim() : !!fabSelectedVehicle;
    if (!hasValidDriver || !hasValidVehicle) return;

    const now = new Date().toISOString();
    setFabSubmitting(true);
    setFabSubmitError('');

    const driverId = fabIsCustomDriver ? `custom_${Date.now()}` : fabSelectedDriver.id;
    const driverName = fabIsCustomDriver ? fabCustomDriverName.trim() : (fabSelectedDriver.name || fabSelectedDriver.fullName);
    const licenseNumber = fabIsCustomDriver ? fabCustomLicense.trim() : (fabSelectedDriver.licenseNumber || '');
    const vehicleId = fabIsCustomVehicle ? `custom_${Date.now() + 1}` : fabSelectedVehicle.id;
    const plateNumber = fabIsCustomVehicle ? fabCustomPlate.trim() : (fabSelectedVehicle.plateNumber || fabSelectedVehicle.plate || 'N/A');

    const jobId = generateJobId(fabSelectedPo.poNumber, fabSelectedPo.materialId, fabSelectedPo.vendorId, driverId, vehicleId);

    const payload = {
      id: generateId(),
      jobId: jobId,
      purchaseOrderId: fabSelectedPo.id,
      poNumber: fabSelectedPo.poNumber,
      vendorId: fabSelectedPo.vendorId,
      vendorName: fabSelectedPo.vendorName,
      driverId: driverId,
      driverName: driverName,
      licenseNumber: licenseNumber,
      vehicleId: vehicleId,
      plateNumber: plateNumber,
      materialId: fabSelectedPo.materialId,
      materialName: fabSelectedPo.materialName,
      quantityOrdered: Number(fabSelectedPo.quantity || 0),
      quantityDelivered: 0,
      quarryId: fabSelectedPo.quarryId || user?.quarryId || '',
      quarryName: fabSelectedPo.quarryName || 'Quarry',
      siteId: fabSelectedPo.siteId || user?.siteId || '',
      siteName: fabSelectedPo.siteName || 'Site',
      destinationLot: fabLotNumber.trim(),
      isScheduled: false,
      isCustomDriver: fabIsCustomDriver,
      isCustomVehicle: fabIsCustomVehicle,
      status: 'weighed_in',
      siteWeighInWeight: weightInNum,
      siteWeighInAt: now,
      createdBy: 'operator_site',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const createdJob = await createDeliveryOrder(payload);
      setDeliveries((current) => [createdJob, ...current]);
      closeFab();
      // Navigate to Weights tab
      router.navigate('/operator-site/weights' as any);
    } catch (error: any) {
      setFabSubmitError(error?.response?.data?.error || error?.message || 'Failed to register unscheduled arrival.');
    } finally {
      setFabSubmitting(false);
    }
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

            return (
              <DataCard key={item.id}>
                {/* Card Header — entire card tappable for weigh-in */}
                <TouchableOpacity
                  onPress={() => toggleExpand(item.id)}
                  activeOpacity={0.7}
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
                  </View>

                  <DetailRow
                    icon="cube-outline"
                    value={`${item.materialName || 'Material'}`}
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

                  <Text
                    style={[styles.timestamp, { color: colors.textTertiary }]}
                  >
                    {`Dispatched: ${formatEAT(item.weighOutAt || item.updatedAt || item.createdAt)}`}
                  </Text>

                  {/* Tap hint */}
                  {!isExpanded && (
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
                        Tap to record Site Arrival Weight
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Driver row — separate touchable to open driver profile */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm }}
                  activeOpacity={0.6}
                  onPress={() => {
                    const d = driverMap[item.driverId];
                    if (d) {
                      setSelectedDriverId(d.id);
                      setSelectedDriverData(d);
                      setDriverProfileVisible(true);
                    }
                  }}
                >
                  {driverMap[item.driverId]?.photoURL ? (
                    <Image source={{ uri: driverMap[item.driverId].photoURL }} style={styles.driverAvatarSmall} />
                  ) : (
                    <View style={[styles.driverAvatarSmall, { backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                        {(driverMap[item.driverId]?.name || item.driverName || 'D').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      {item.driverName || 'Unassigned'}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                      {item.plateNumber || 'N/A'}
                    </Text>
                  </View>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* ─── Expanded Weight In Form ─── */}
                {isExpanded && (
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

                    {/* Storage Lot Input */}
                    <View style={[styles.lotInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                      <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                      <TextInput
                        style={[styles.lotInputField, { color: colors.text }]}
                        placeholder="Storage Lot (e.g., Lot 4, Zone B-12)"
                        placeholderTextColor={colors.textTertiary}
                        value={getLotInput(item.id)}
                        onChangeText={(value) => setLotInput(item.id, value)}
                      />
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

      {/* ─── FAB: Register Unscheduled Arrival ─── */}
      <TouchableOpacity
        style={[styles.fabBtn, { backgroundColor: colors.primary }]}
        onPress={() => setFabVisible(true)}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ─── FAB Modal: Register Unscheduled Arrival ─── */}
      <Modal visible={fabVisible} transparent animationType="slide" onRequestClose={closeFab}>
        <View style={styles.fabModalBackdrop}>
          <View style={[styles.fabSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md }}>
              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Register Unscheduled Arrival</Text>
                  <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
                    Enter a Purchase Order, assign driver and vehicle, and specify the destination lot.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.inputBg }]} onPress={closeFab}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* PO Search */}
              <View style={[styles.fabInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.fabInput, { color: colors.text }]}
                  placeholder="Search PO (e.g. POMAT004/V01)"
                  placeholderTextColor={colors.textTertiary}
                  value={fabSelectedPo ? fabSelectedPo.poNumber : fabPoSearch}
                  onChangeText={(value) => { setFabPoSearch(value); setFabSelectedPo(null); setFabSelectedDriver(null); setFabSelectedVehicle(null); }}
                />
              </View>

              {!fabSelectedPo ? (
                <View style={styles.fabOptionList}>
                  {fabMatchingPOs.map((order) => (
                    <TouchableOpacity
                      key={order.id}
                      style={[styles.fabOptionRow, { borderColor: colors.border }]}
                      onPress={() => { setFabSelectedPo(order); setFabPoSearch(order.poNumber); setFabSelectedDriver(null); setFabSelectedVehicle(null); }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fabOptionTitle, { color: colors.text }]}>{order.poNumber}</Text>
                        <Text style={[styles.fabOptionMeta, { color: colors.textMuted }]}>{order.vendorName} · {order.materialName}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.fabSelectedBlock}>
                  <Text style={[styles.fabPrefillTitle, { color: colors.text }]}>Order Details</Text>
                  <DetailRow icon="document-outline" value={`Order: ${fabSelectedPo.poNumber}`} />
                  <DetailRow icon="business-outline" value={`Vendor: ${fabSelectedPo.vendorName}`} />
                  <DetailRow icon="cube-outline" value={`Material: ${fabSelectedPo.materialName}`} />
                </View>
              )}

              {/* Driver Selection */}
              {fabSelectedPo && (
                <>
                  <View style={styles.fabSectionHeader}>
                    <Text style={[styles.fabLabel, { color: colors.text }]}>Select Driver</Text>
                    <TouchableOpacity
                      style={[styles.fabToggleBtn, { backgroundColor: fabIsCustomDriver ? colors.primary : colors.inputBg, borderColor: fabIsCustomDriver ? colors.primary : colors.border }]}
                      onPress={() => { setFabIsCustomDriver(!fabIsCustomDriver); setFabSelectedDriver(null); }}
                    >
                      <Ionicons name={fabIsCustomDriver ? 'person-add' : 'person-add-outline'} size={13} color={fabIsCustomDriver ? '#FFFFFF' : colors.textMuted} />
                      <Text style={[styles.fabToggleText, { color: fabIsCustomDriver ? '#FFFFFF' : colors.textMuted }]}>Add Custom Driver</Text>
                    </TouchableOpacity>
                  </View>

                  {fabIsCustomDriver ? (
                    <View style={{ gap: Spacing.sm }}>
                      <View style={[styles.fabInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                        <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                        <TextInput
                          style={[styles.fabInput, { color: colors.text }]}
                          placeholder="Driver Full Name"
                          placeholderTextColor={colors.textTertiary}
                          value={fabCustomDriverName}
                          onChangeText={setFabCustomDriverName}
                        />
                      </View>
                      <View style={[styles.fabInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                        <Ionicons name="card-outline" size={18} color={colors.textMuted} />
                        <TextInput
                          style={[styles.fabInput, { color: colors.text }]}
                          placeholder="License Number"
                          placeholderTextColor={colors.textTertiary}
                          value={fabCustomLicense}
                          onChangeText={setFabCustomLicense}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.fabOptionList}>
                      {fabVendorDrivers.length ? (
                        fabVendorDrivers.map((driver) => {
                          const active = fabSelectedDriver?.id === driver.id;
                          return (
                            <TouchableOpacity
                              key={driver.id}
                              style={[styles.fabDriverRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}10` : colors.surface }]}
                              onPress={() => setFabSelectedDriver(driver)}
                            >
                              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? colors.primary : colors.textMuted} />
                              {driver.photoURL ? (
                                <Image source={{ uri: driver.photoURL }} style={styles.fabDriverPhoto} />
                              ) : (
                                <View style={[styles.fabDriverPhoto, { backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }]}>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>
                                    {(driver.name || driver.fullName || 'D').charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.fabOptionTitle, { color: colors.text }]}>{driver.name || driver.fullName}</Text>
                                <Text style={[styles.fabOptionMeta, { color: colors.textMuted }]}>License: {driver.licenseNumber}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <Text style={[styles.fabEmpty, { color: colors.textMuted }]}>No active drivers for this vendor.</Text>
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Vehicle Selection */}
              {fabSelectedPo && (
                <>
                  <View style={styles.fabSectionHeader}>
                    <Text style={[styles.fabLabel, { color: colors.text }]}>Select Vehicle (Number Plate)</Text>
                    <TouchableOpacity
                      style={[styles.fabToggleBtn, { backgroundColor: fabIsCustomVehicle ? colors.primary : colors.inputBg, borderColor: fabIsCustomVehicle ? colors.primary : colors.border }]}
                      onPress={() => { setFabIsCustomVehicle(!fabIsCustomVehicle); setFabSelectedVehicle(null); }}
                    >
                      <Ionicons name={fabIsCustomVehicle ? 'car-sport' : 'car-sport-outline'} size={13} color={fabIsCustomVehicle ? '#FFFFFF' : colors.textMuted} />
                      <Text style={[styles.fabToggleText, { color: fabIsCustomVehicle ? '#FFFFFF' : colors.textMuted }]}>Add Custom Vehicle</Text>
                    </TouchableOpacity>
                  </View>

                  {fabIsCustomVehicle ? (
                    <View style={[styles.fabInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                      <Ionicons name="car-outline" size={18} color={colors.textMuted} />
                      <TextInput
                        style={[styles.fabInput, { color: colors.text }]}
                        placeholder="Number Plate (e.g. KAA 123B)"
                        placeholderTextColor={colors.textTertiary}
                        value={fabCustomPlate}
                        onChangeText={setFabCustomPlate}
                      />
                    </View>
                  ) : (
                    <View style={styles.fabOptionList}>
                      {fabVendorVehicles.length ? (
                        fabVendorVehicles.map((vehicle) => {
                          const active = fabSelectedVehicle?.id === vehicle.id;
                          return (
                            <TouchableOpacity
                              key={vehicle.id}
                              style={[styles.fabDriverRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}10` : colors.surface }]}
                              onPress={() => setFabSelectedVehicle(vehicle)}
                            >
                              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? colors.primary : colors.textMuted} />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.fabOptionTitle, { color: colors.text }]}>{vehicle.plateNumber || vehicle.plate}</Text>
                                <Text style={[styles.fabOptionMeta, { color: colors.textMuted }]}>{vehicle.make} {vehicle.model} ({vehicle.capacity}t)</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <Text style={[styles.fabEmpty, { color: colors.textMuted }]}>No active vehicles for this vendor.</Text>
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Site Arrival Weight (Weight In) */}
              {fabSelectedPo && (
                <View style={[styles.weightInputContainer, { borderColor: '#F59E0B', backgroundColor: colors.inputBg }]}>
                  <TextInput
                    style={[styles.weightInputField, { color: colors.text }]}
                    placeholder="0.0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={fabWeightIn}
                    onChangeText={setFabWeightIn}
                  />
                  <Text style={[styles.weightInputSuffix, { color: colors.textMuted }]}>Tonnes</Text>
                </View>
              )}

              {/* Storage Lot Input */}
              {fabSelectedPo && (
                <View style={[styles.fabInputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                  <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[styles.fabInput, { color: colors.text }]}
                    placeholder="Storage Lot (e.g., Lot 4, Zone B-12)"
                    placeholderTextColor={colors.textTertiary}
                    value={fabLotNumber}
                    onChangeText={setFabLotNumber}
                  />
                </View>
              )}

              {fabSubmitError ? <Text style={[styles.fabSubmitError, { color: colors.danger }]}>{fabSubmitError}</Text> : null}

              <TouchableOpacity
                style={[styles.fabCreateBtn, { backgroundColor: (() => {
                  const weightInNum = parseFloat(fabWeightIn);
                  const hasValidWeight = !isNaN(weightInNum) && weightInNum > 0;
                  const hasValidDriver = fabIsCustomDriver ? (fabCustomDriverName.trim() && fabCustomLicense.trim()) : !!fabSelectedDriver;
                  const hasValidVehicle = fabIsCustomVehicle ? !!fabCustomPlate.trim() : !!fabSelectedVehicle;
                  return fabSelectedPo && hasValidWeight && hasValidDriver && hasValidVehicle && fabLotNumber.trim() && !fabSubmitting ? colors.primary : colors.border;
                })() }]}
                onPress={handleFabSubmit}
                disabled={(() => {
                  const weightInNum = parseFloat(fabWeightIn);
                  const hasValidWeight = !isNaN(weightInNum) && weightInNum > 0;
                  const hasValidDriver = fabIsCustomDriver ? (fabCustomDriverName.trim() && fabCustomLicense.trim()) : !!fabSelectedDriver;
                  const hasValidVehicle = fabIsCustomVehicle ? !!fabCustomPlate.trim() : !!fabSelectedVehicle;
                  return !fabSelectedPo || !hasValidWeight || !hasValidDriver || !hasValidVehicle || !fabLotNumber.trim() || fabSubmitting;
                })()}
              >
                {fabSubmitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />}
                <Text style={styles.fabCreateBtnText}>{fabSubmitting ? 'Registering...' : 'Confirm & Add'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      {/* Driver Profile Modal */}
      <DriverProfileModal
        visible={driverProfileVisible}
        driverId={selectedDriverId}
        driverData={selectedDriverData}
        onClose={() => {
          setDriverProfileVisible(false);
          setSelectedDriverId('');
          setSelectedDriverData(null);
        }}
      />
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.sm },
  driverAvatarSmall: { width: 24, height: 24, borderRadius: 12 },
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
  // Lot Input (scheduled weigh-in form)
  lotInputWrap: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  lotInputField: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
  // FAB Button
  fabBtn: { position: 'absolute', right: Spacing.xl, bottom: Spacing.xl, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14 },
  // FAB Modal
  fabModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  fabSheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  iconButton: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  fabInputWrap: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  fabInput: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
  fabOptionList: { gap: Spacing.sm },
  fabOptionRow: { minHeight: 58, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fabOptionTitle: { fontSize: 14, fontWeight: '900' },
  fabOptionMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  fabSelectedBlock: { gap: Spacing.sm },
  fabPrefillTitle: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  fabLabel: { fontSize: 14, fontWeight: '900', marginTop: Spacing.xs },
  fabSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  fabToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  fabToggleText: { fontSize: 11, fontWeight: '800' },
  fabDriverRow: { minHeight: 58, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fabDriverPhoto: { width: 32, height: 32, borderRadius: 16 },
  fabEmpty: { fontSize: 13, fontWeight: '700', paddingVertical: Spacing.md },
  fabSubmitError: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  fabCreateBtn: { minHeight: 50, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  fabCreateBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
