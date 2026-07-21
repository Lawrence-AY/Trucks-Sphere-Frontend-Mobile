import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  fetchPurchaseOrders,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  useDeliveryOrders,
  useDrivers,
  usePurchaseOrders,
  useVehicles,
} from '../../store/realtimeData';
import { useRealTimeSyncStore } from '../../store/realTimeSyncStore';
import { formatEAT, generateId, generateJobKey } from '../../utils/helpers';
import { isActiveJob, normalizeJobStatus } from '../../utils/jobStatus';
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';
import DriverProfileModal from '../../components/DriverProfileModal';

export default function OperatorQuarryDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const deliveries = useDeliveryOrders();
  const drivers = useDrivers();
  const vehicles = useVehicles();
  const refresh = useRealTimeSyncStore((s) => s.refresh);
  const optimisticUpdate = useRealTimeSyncStore((s) => s.optimisticUpdate);
  const purchaseOrders = usePurchaseOrders();
  const [freshPurchaseOrders, setFreshPurchaseOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [poSearch, setPoSearch] = useState('');
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [driverProfileVisible, setDriverProfileVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedDriverData, setSelectedDriverData] = useState<any>(null);

  const loadData = async (silent?: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const [orders] = await Promise.all([
        fetchPurchaseOrders(),
        refresh('purchaseOrders'),
        refresh('deliveryOrders'),
      ]);
      setFreshPurchaseOrders(orders || []);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-report loading complete once realtime data arrives
  useEffect(() => {
    if (deliveries.length > 0 || drivers.length > 0 || vehicles.length > 0) {
      setLoading(false);
    }
  }, [deliveries.length, drivers.length, vehicles.length]);

  // A quarry queue is shared by the staff working at that quarry. A shift
  // must be able to continue jobs created or weighed by another operator.
  const operatorUid = user?.uid || '';
  const operatorQuarryId = (user as any)?.quarryId || '';
  const operatorQuarryLocation = (user as any)?.quarryLocation || '';

  const operatorDeliveries = useMemo(() => {
    return deliveries.filter((delivery: any) =>
      (operatorQuarryId && delivery.quarryId === operatorQuarryId) ||
      (operatorQuarryLocation && String(delivery.quarryName || '').trim().toLowerCase() === operatorQuarryLocation.trim().toLowerCase()) ||
      (operatorUid && [delivery.createdByUid, delivery.quarryOperatorUid, delivery.weighInByUid, delivery.weighOutByUid].includes(operatorUid)),
    );
  }, [deliveries, operatorQuarryId, operatorQuarryLocation, operatorUid]);

  // Dispatched loads have departed the quarry and must only appear in
  // tracking/site views, never in the quarry queue or dashboard snapshot.
  const queue = operatorDeliveries.filter((d) => (
    !['DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_SITE', 'SITE_WEIGHED_IN', 'SITE_WEIGHED_OUT', 'COMPLETED']
      .includes(normalizeJobStatus(d.status)) &&
    isActiveJob(d.status) &&
    !d.weighInWeight
  ));
  const weighedOut = operatorDeliveries.filter((d) => normalizeJobStatus(d.status) === 'QUARRY_WEIGHED_OUT');
  const completed = operatorDeliveries.filter((d) => !isActiveJob(d.status));

  const matchingPurchaseOrders = useMemo(() => {
    const term = poSearch.trim().toLowerCase();
    const orders = [...purchaseOrders, ...freshPurchaseOrders].filter(
      (order, index, items) => items.findIndex((item) => item.id === order.id) === index,
    );
    return orders
      // An operator chooses the work order first. The job card then records
      // both that PO's quarry and the operator who created the job.
      .filter((order) => !['completed', 'cancelled', 'archived'].includes(String(order.status || '').toLowerCase()))
      .filter((order) => {
        const ordered = Number(order.quantity ?? 0);
        const allocated = Number(order.allocatedQuantity ?? order.quantityDelivered ?? order.deliveredQuantity ?? 0);
        return Math.max(ordered - allocated, 0) > 0;
      })
      .filter(
        (order) =>
          !term ||
          order.poNumber?.toLowerCase().includes(term) ||
          order.vendorName?.toLowerCase().includes(term),
      );
  }, [poSearch, purchaseOrders, freshPurchaseOrders]);

  const vendorDrivers = useMemo(() => {
    if (!selectedPo) return [];
    return drivers.filter(
      (driver) => driver.vendorId === selectedPo.vendorId && String(driver.status || '').toLowerCase() === 'active',
    );
  }, [drivers, selectedPo]);

  const vendorVehicles = useMemo(() => {
    if (!selectedPo) return [];
    return vehicles.filter(
      (vehicle) => vehicle.vendorId === selectedPo.vendorId && String(vehicle.status || '').toLowerCase() === 'active',
    );
  }, [vehicles, selectedPo]);

  // Check if the selected driver is on ANY active job
  const driverActiveJob = useMemo(() => {
    if (!selectedDriver) return null;
    return deliveries.find(
      (d) =>
        d.driverId === selectedDriver.id &&
        !['delivered', 'completed', 'cancelled'].includes(d.status),
    );
  }, [deliveries, selectedDriver]);

  // Check if the selected vehicle is on ANY active job
  const vehicleActiveJob = useMemo(() => {
    if (!selectedVehicle) return null;
    return deliveries.find(
      (d) =>
        (d.vehicleId === selectedVehicle.id ||
          d.plateNumber === (selectedVehicle.plateNumber || selectedVehicle.plate)) &&
        !['delivered', 'completed', 'cancelled'].includes(d.status),
    );
  }, [deliveries, selectedVehicle]);

  // Either driver or truck busy blocks assignment
  const isDriverBusy = !!driverActiveJob;
  const isVehicleBusy = !!vehicleActiveJob;
  const isDriverVehicleBusy = isDriverBusy || isVehicleBusy;
  const busyReason = isDriverBusy && isVehicleBusy
    ? `This driver (${driverActiveJob?.jobId}) and truck (${vehicleActiveJob?.jobId}) each already have an active job.`
    : isDriverBusy
    ? `Driver "${selectedDriver?.name || selectedDriver?.fullName}" is already on an active job (${driverActiveJob?.jobId}).`
    : isVehicleBusy
    ? `Truck "${selectedVehicle?.plateNumber || selectedVehicle?.plate}" is already on an active job (${vehicleActiveJob?.jobId}).`
    : '';

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
    // Build the job key (base identifier without J number).
    // The backend jobIdService assigns the final /J#### sequentially.
    const jobKey = generateJobKey(selectedPo.poNumber, selectedPo.materialId, selectedPo.vendorId, selectedDriver.id, selectedVehicle.id);
    const payload = {
      id: generateId(),
      jobKey: jobKey,
      purchaseOrderId: selectedPo.id,
      poNumber: selectedPo.poNumber,
      vendorId: selectedPo.vendorId,
      vendorName: selectedPo.vendorName,
      companyName: selectedPo.companyName || selectedPo.vendorName,
      driverId: selectedDriver.id,
      driverName: selectedDriver.name || selectedDriver.fullName,
      vehicleId: selectedVehicle.id,
      plateNumber: selectedVehicle.plateNumber || selectedVehicle.plate || 'N/A',
      materialId: selectedPo.materialId,
      materialName: selectedPo.materialName,
      materialSize: selectedPo.materialSize || selectedPo.materialGrade || '',
      quantityOrdered: Number(selectedPo.quantity || 0),
      quantityDelivered: 0,
      quarryId: selectedPo.quarryId || user?.quarryId || '',
      quarryName: selectedPo.quarryName || 'Quarry',
      siteId: selectedPo.siteId || user?.siteId || '',
      siteName: selectedPo.siteName || 'Site',
      operatorUsername: user?.displayName || user?.email?.split('@')[0] || '',
      operatorUid: user?.uid || '',
      operatorName: user?.displayName || user?.name || user?.email?.split('@')[0] || '',
      createdBy: 'operator_quarry',
      createdByUid: user?.uid || '',
      createdByName: user?.displayName || user?.email?.split('@')[0] || '',
      quarryOperatorUid: user?.uid || '',
      createdAt: now,
      updatedAt: now,
    };
    try {
      const createdJob = await createDeliveryOrder(payload);
      optimisticUpdate('deliveryOrders', createdJob);
      closeAddForm();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.error || error?.message || 'Failed to create job card.');
      // Don't close the form --- let the user fix & retry
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageShell
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />
        }
      >


        {loading ? (
          <DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading queue...</Text></DataCard>
        ) : queue.length ? (
          queue.slice(0, 20).map((item) => {
            const stage =
              item.status === 'delivered' || item.status === 'completed'
                ? 'completed'
                : item.weighOutWeight
                ? 'weighed_out'
                : item.weighInWeight
                ? 'weighed_in'
                : 'queued';

            const stageConfig: Record<string, { label: string; color: string; icon: string }> = {
              queued: { label: 'Awaiting Weigh-In', color: colors.warning, icon: 'time-outline' },
              weighed_in: { label: 'Weighed In', color: '#2563EB', icon: 'download-outline' },
              weighed_out: { label: 'Weighed Out', color: '#7C3AED', icon: 'arrow-up-outline' },
              completed: { label: 'Completed', color: colors.success, icon: 'checkmark-circle' },
            };
            const s = stageConfig[stage];

            return (
              <DataCard
                key={item.id}
                onPress={() => router.push(`/operator-quarry/weigh-in?id=${item.jobId}` as any)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
                    <Text style={[styles.jobMeta, { color: colors.textMuted }]}>{item.poNumber || 'No PO'}</Text>
                  </View>
                </View>
                {(() => {
                  const d = drivers.find((dr: any) => dr.id === item.driverId);
                  return (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}
                      onPress={() => {
                        if (d) {
                          setSelectedDriverId(d.id);
                          setSelectedDriverData(d);
                          setDriverProfileVisible(true);
                        }
                      }}
                      activeOpacity={0.6}
                    >
                      {/* Quick driver photo lookup */}
                      {d?.photoURL ? (
                        <Image source={{ uri: d.photoURL }} style={styles.queueDriverPhoto} />
                      ) : (
                        <View style={[styles.queueDriverPhoto, { backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                            {(d?.name || d?.fullName || 'D').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
                      {!d?.photoURL && (
                        <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                  );
                })()}
                <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'}`} />
                <DetailRow icon="business-outline" value={`${item.vendorName || 'N/A'}`} />
                <View style={[styles.stageBadge, { backgroundColor: `${s.color}15`, borderColor: `${s.color}44` }]}>
                  <Ionicons name={s.icon as any} size={14} color={s.color} />
                  <Text style={[styles.stageText, { color: s.color }]}>{s.label}</Text>
                </View>
                <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                  {formatEAT(item.updatedAt || item.createdAt)}
                </Text>
              </DataCard>
            );
          })
        ) : (
          <EmptyState icon="clipboard-outline" title="Queue Empty" subtitle="No active jobs in the quarry queue." />
        )}

        {/* Weighed-Out Snapshot */}
        {weighedOut.length > 0 && (
          <>
            <SectionTitle title={`Weighed Out — ${weighedOut.length}`} />
            {weighedOut.slice(0, 10).map((item) => {
              const wIn = item.weighInWeight || 0;
              const wOut = item.weighOutWeight || 0;
              const net = item.netWeight ?? (wOut - wIn);
              return (
                <DataCard key={item.id}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.jobId, { color: colors.text }]}>{item.jobId}</Text>
                      <Text style={[styles.jobMeta, { color: colors.textMuted }]}>{item.poNumber || 'No PO'}</Text>
                    </View>
                  </View>
                  <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
                  <DetailRow icon="cube-outline" value={`${item.materialName || 'Material'}`} />
                 
                  <DetailRow icon="person-outline" value={`Dispatched by: ${item.weighOutByName || item.createdByName || item.operatorUsername || '—'}`} />
                  {/* Weight summary */}
                  <View style={[styles.snapshotWeightRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <View style={styles.weightCell}>
                      <Text style={[styles.wLabel, { color: colors.textMuted }]}>IN</Text>
                      <Text style={[styles.wValue, { color: '#2563EB' }]}>{wIn.toFixed(1)}T</Text>
                    </View>
                    <View style={styles.weightCell}>
                      <Text style={[styles.wLabel, { color: colors.textMuted }]}>OUT</Text>
                      <Text style={[styles.wValue, { color: '#7C3AED' }]}>{wOut.toFixed(1)}T</Text>
                    </View>
                    <View style={styles.weightCell}>
                      <Text style={[styles.wLabel, { color: colors.textMuted }]}>NET</Text>
                      <Text style={[styles.wValue, { color: colors.success, fontSize: 16 }]}>{net > 0 ? net.toFixed(1) : '—'}T</Text>
                    </View>
                  </View>
                  <View style={[styles.stageBadge, { backgroundColor: '#7C3AED15', borderColor: '#7C3AED44' }]}>
                    <Ionicons name="arrow-up-outline" size={14} color="#7C3AED" />
                    <Text style={[styles.stageText, { color: '#7C3AED' }]}>Weighed Out</Text>
                  </View>
                  <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                    {formatEAT(item.weighOutAt || item.updatedAt || item.createdAt)}
                  </Text>
                </DataCard>
              );
            })}
          </>
        )}
      </PageShell>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => { void loadData(true); setAddVisible(true); }}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Job Card Modal */}
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={closeAddForm}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.addSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Create Job Card</Text>
                <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
                  Search a Purchase Order, then assign a driver and vehicle to create a delivery job.
                </Text>
              </View>
              <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.inputBg }]} onPress={closeAddForm}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.poInput, { color: colors.text }]}
                placeholder="Search PO (e.g. POMAT004/V01)"
                placeholderTextColor={colors.textTertiary}
                value={selectedPo ? selectedPo.poNumber : poSearch}
                onChangeText={(value) => { setPoSearch(value); setSelectedPo(null); setSelectedDriver(null); setSelectedVehicle(null); }}
              />
            </View>
            <Text style={[styles.searchHint, { color: colors.textMuted }]}>Start typing to search purchase orders, or choose one from the list below.</Text>

            {!selectedPo ? (
              <ScrollView style={styles.poScrollView} showsVerticalScrollIndicator={true} nestedScrollEnabled>
                <View style={styles.optionList}>
                  {matchingPurchaseOrders.length ? (
                    matchingPurchaseOrders.map((order) => (
                      <TouchableOpacity
                        key={order.id}
                        style={[styles.optionRow, { borderColor: colors.border }]}
                        onPress={() => { setSelectedPo(order); setPoSearch(order.poNumber); setSelectedDriver(null); setSelectedVehicle(null); }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionTitle, { color: colors.text }]}>{order.poNumber}</Text>
                          <Text style={[styles.optionMeta, { color: colors.textMuted }]}>{order.vendorName} · {order.materialName}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={[styles.emptyDrivers, { color: colors.textMuted }]}>
                      {poSearch.trim()
                        ? 'No matching purchase orders found.'
                        : 'No active purchase orders are available.'}
                    </Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.selectedBlock}>
                <Text style={[styles.prefillTitle, { color: colors.text }]}>Order Details</Text>
                <DetailRow icon="document-outline" value={`Order: ${selectedPo.poNumber}`} />
                <DetailRow icon="business-outline" value={`Vendor: ${selectedPo.vendorNumber || String(selectedPo.vendorId || '').replace(/^V/i, '')} - ${selectedPo.vendorName}`} />
                <DetailRow icon="cube-outline" value={`Material: ${selectedPo.materialNumber || String(selectedPo.materialId || '').replace(/^MAT/i, '')} - ${selectedPo.materialName}`} />
               
              </View>
            )}

            {selectedPo && (
              <>
                <Text style={[styles.driverLabel, { color: colors.text }]}>Select Driver</Text>
                <ScrollView style={styles.selectScrollView} showsVerticalScrollIndicator={true} nestedScrollEnabled>
                  <View style={styles.optionList}>
                    {vendorDrivers.length ? (
                      vendorDrivers.map((driver) => {
                        const active = selectedDriver?.id === driver.id;
                        return (
                          <TouchableOpacity
                            key={driver.id}
                            style={[styles.driverRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}10` : colors.surface }]}
                            onPress={() => setSelectedDriver(driver)}
                          >
                            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? colors.primary : colors.textMuted} />
                            {driver.photoURL ? (
                              <Image source={{ uri: driver.photoURL }} style={styles.modalDriverPhoto} />
                            ) : (
                              <View style={[styles.modalDriverPhoto, { backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>
                                  {(driver.name || driver.fullName || 'D').charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.optionTitle, { color: colors.text }]}>{driver.name || driver.fullName}</Text>
                              <Text style={[styles.optionMeta, { color: colors.textMuted }]}>License: {driver.licenseNumber}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={[styles.emptyDrivers, { color: colors.textMuted }]}>No active drivers for this vendor.</Text>
                    )}
                  </View>
                </ScrollView>
              </>
            )}

            {selectedPo && (
              <>
                <Text style={[styles.driverLabel, { color: colors.text }]}>Select Vehicle (Number Plate)</Text>
                <ScrollView style={styles.selectScrollView} showsVerticalScrollIndicator={true} nestedScrollEnabled>
                  <View style={styles.optionList}>
                    {vendorVehicles.length ? (
                      vendorVehicles.map((vehicle) => {
                        const active = selectedVehicle?.id === vehicle.id;
                        return (
                          <TouchableOpacity
                            key={vehicle.id}
                            style={[styles.driverRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}10` : colors.surface }]}
                            onPress={() => setSelectedVehicle(vehicle)}
                          >
                            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? colors.primary : colors.textMuted} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.optionTitle, { color: colors.text }]}>{vehicle.plateNumber || vehicle.plate}</Text>
                              <Text style={[styles.optionMeta, { color: colors.textMuted }]}>{vehicle.make} {vehicle.model} ({vehicle.capacity}t)</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={[styles.emptyDrivers, { color: colors.textMuted }]}>No active vehicles for this vendor.</Text>
                    )}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Driver-Vehicle busy warning */}
            {isDriverVehicleBusy && selectedDriver && selectedVehicle && (
              <View style={[styles.busyWarning, { backgroundColor: '#EF444410', borderColor: '#EF444433' }]}>
                <Ionicons name="warning-outline" size={16} color="#EF4444" />
                <Text style={[styles.busyWarningText, { color: '#EF4444' }]}>
                  {busyReason}
                </Text>
              </View>
            )}

            {submitError ? <Text style={[styles.submitError, { color: colors.danger }]}>{submitError}</Text> : null}

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: selectedPo && selectedDriver && selectedVehicle && !submitting && !isDriverVehicleBusy ? colors.primary : colors.border }]}
              onPress={createQueueJob}
              disabled={!selectedPo || !selectedDriver || !selectedVehicle || submitting || isDriverVehicleBusy}
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="add-circle-outline" size={19} color="#FFFFFF" />}
              <Text style={styles.createBtnText}>{submitting ? 'Creating...' : 'Create Job Card'}</Text>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  jobId: { fontSize: 15, fontWeight: '700' },
  jobMeta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  stageBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, marginTop: Spacing.sm },
  stageText: { fontSize: 11, fontWeight: '700' },
  timestamp: { fontSize: 14, marginTop: Spacing.sm },
  queueDriverPhoto: { width: 24, height: 24, borderRadius: 12 },
  searchHint: { fontSize: 12, lineHeight: 17, marginTop: Spacing.xs },
  modalDriverPhoto: { width: 32, height: 32, borderRadius: 16 },
  fab: { position: 'absolute', right: Spacing.xl, bottom: Spacing.xl, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  addSheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, maxHeight: '90%', gap: Spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  iconButton: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  poInput: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
  poScrollView: { maxHeight: 400 },
  selectScrollView: { maxHeight: 250 },
  optionList: { gap: Spacing.sm },
  optionRow: { minHeight: 58, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  optionTitle: { fontSize: 14, fontWeight: '900' },
  optionMeta: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  prefillTitle: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  selectedBlock: { gap: Spacing.sm },
  driverLabel: { fontSize: 14, fontWeight: '900', marginTop: Spacing.xs },
  driverRow: { minHeight: 58, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emptyDrivers: { fontSize: 13, fontWeight: '700', paddingVertical: Spacing.md },
  submitError: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  createBtn: { minHeight: 50, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  createBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  // Busy warning styles
  busyWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  busyWarningText: { fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  // Snapshot weighed-out weight row
  snapshotWeightRow: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm, marginTop: Spacing.sm, gap: Spacing.xs },
  weightCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  wLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  wValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
});
