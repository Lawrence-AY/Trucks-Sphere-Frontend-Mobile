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
  fetchDeliveryOrders,
  fetchDrivers,
  fetchPurchaseOrders,
  fetchVehicles,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { formatEAT, generateId, generateJobId } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  MetricTile,
  PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';

export default function OperatorQuarryDashboardScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
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

  const loadData = async (silent?: boolean) => {
    if (!silent) setRefreshing(true);
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

  useEffect(() => { loadData(); }, []);

  const queue = deliveries.filter(
    (d) => !['delivered', 'completed', 'cancelled'].includes(d.status) && !d.weighInWeight,
  );
  const completed = deliveries.filter(
    (d) => d.status === 'delivered' || d.status === 'completed',
  );

  const matchingPurchaseOrders = useMemo(() => {
    const term = poSearch.trim().toLowerCase();
    return purchaseOrders
      .filter((order) => ['approved', 'pending', 'in_progress'].includes(order.status))
      .filter(
        (order) =>
          !term ||
          order.poNumber?.toLowerCase().includes(term) ||
          order.vendorName?.toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [poSearch, purchaseOrders]);

  const vendorDrivers = useMemo(() => {
    if (!selectedPo) return [];
    return drivers.filter(
      (driver) => driver.vendorId === selectedPo.vendorId && driver.status === 'active',
    );
  }, [drivers, selectedPo]);

  const vendorVehicles = useMemo(() => {
    if (!selectedPo) return [];
    return vehicles.filter(
      (vehicle) => vehicle.vendorId === selectedPo.vendorId && vehicle.status === 'active',
    );
  }, [vehicles, selectedPo]);

  // Check if a driver+vehicle combo has an active (non-completed) job
  const driverVehicleActiveJob = useMemo(() => {
    if (!selectedDriver || !selectedVehicle) return null;
    return deliveries.find(
      (d) =>
        d.driverId === selectedDriver.id &&
        d.plateNumber === (selectedVehicle.plateNumber || selectedVehicle.plate) &&
        !['delivered', 'completed', 'cancelled'].includes(d.status),
    );
  }, [deliveries, selectedDriver, selectedVehicle]);

  const isDriverVehicleBusy = !!driverVehicleActiveJob;

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
    // Generate job ID: POMAT###/V###/D###/T###/J####
    const jobId = generateJobId(selectedPo.poNumber, selectedPo.materialId, selectedPo.vendorId, selectedDriver.id, selectedVehicle.id);
    const payload = {
      id: generateId(),
      jobId: jobId,
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
      quantityOrdered: Number(selectedPo.quantity || 0),
      quantityDelivered: 0,
      quarryId: selectedPo.quarryId || user?.quarryId || '',
      quarryName: selectedPo.quarryName || 'Quarry',
      siteId: selectedPo.siteId || user?.siteId || '',
      siteName: selectedPo.siteName || 'Site',
      createdBy: 'operator_quarry',
      createdAt: now,
      updatedAt: now,
    };
    try {
      const createdJob = await createDeliveryOrder(payload);
      setDeliveries((current) => [createdJob, ...current]);
      closeAddForm();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.error || error?.message || 'Failed to create job card.');
      // Don't close the form — let the user fix & retry
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  {/* Quick driver photo lookup */}
                  {(() => {
                    const d = drivers.find((dr: any) => dr.id === item.driverId);
                    return d?.photoURL ? (
                      <Image source={{ uri: d.photoURL }} style={styles.queueDriverPhoto} />
                    ) : null;
                  })()}
                  <DetailRow icon="person-outline" value={`${item.driverName || 'Unassigned'} · ${item.plateNumber || 'N/A'}`} />
                </View>
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
      </PageShell>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setAddVisible(true)} activeOpacity={0.86}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Job Card Modal */}
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={closeAddForm}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.addSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md }}>
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

              {!selectedPo ? (
                <View style={styles.optionList}>
                  {matchingPurchaseOrders.map((order) => (
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
                  ))}
                </View>
              ) : (
                <View style={styles.selectedBlock}>
                  <Text style={[styles.prefillTitle, { color: colors.text }]}>Order Details</Text>
                  <DetailRow icon="document-outline" value={`Order: ${selectedPo.poNumber}`} />
                  <DetailRow icon="business-outline" value={`Vendor: ${selectedPo.vendorName}`} />
                  <DetailRow icon="cube-outline" value={`Material: ${selectedPo.materialName}`} />
                </View>
              )}

              {selectedPo && (
                <>
                  <Text style={[styles.driverLabel, { color: colors.text }]}>Select Driver</Text>
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
                </>
              )}

              {selectedPo && (
                <>
                  <Text style={[styles.driverLabel, { color: colors.text }]}>Select Vehicle (Number Plate)</Text>
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
                </>
              )}

              {/* Driver-Vehicle busy warning */}
              {isDriverVehicleBusy && selectedDriver && selectedVehicle && (
                <View style={[styles.busyWarning, { backgroundColor: '#EF444410', borderColor: '#EF444433' }]}>
                  <Ionicons name="warning-outline" size={16} color="#EF4444" />
                  <Text style={[styles.busyWarningText, { color: '#EF4444' }]}>
                    This driver and truck already have an active job ({driverVehicleActiveJob?.jobId}). They must complete it before a new job can be created.
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
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  modalDriverPhoto: { width: 32, height: 32, borderRadius: 16 },
  fab: { position: 'absolute', right: Spacing.xl, bottom: Spacing.xl, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  addSheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  iconButton: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  poInput: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
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
});