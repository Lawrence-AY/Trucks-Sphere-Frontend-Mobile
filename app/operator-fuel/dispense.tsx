import React, { useEffect, useMemo, useState } from 'react';
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
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import {
  fetchDeliveryOrders,
  createFuelRecord,
  fetchFuelRecords,
  fetchVendors,
  fetchDrivers,
  fetchVehicles,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { formatEAT, generateFuelRecordId, normalizeVendorId, padToThree } from '../../utils/helpers';
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
} from '../../components/EnterpriseUI';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FlowStep = 'list' | 'vendor' | 'driver' | 'truck' | 'form';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function typePrefix(id: string): 'V' | 'D' | 'T' | 'J' {
  const upper = String(id).toUpperCase();
  if (upper.startsWith('V')) return 'V';
  if (upper.startsWith('D')) return 'D';
  if (upper.startsWith('T')) return 'T';
  return 'J';
}

function buildFuelId(vendorId: string, driverId: string, truckId: string, fuelSeq: number): string {
  const v = `${typePrefix(vendorId)}${padToThree(vendorId)}`;
  const d = `${typePrefix(driverId)}${padToThree(driverId)}`;
  const t = `${typePrefix(truckId)}${padToThree(truckId)}`;
  return `${v}/${d}/${t}/F${String(fuelSeq).padStart(3, '0')}`;
}

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
  const [search, setSearch] = useState('');

  const [activeJob, setActiveJob] = useState<any>(null);
  const [fuelAmount, setFuelAmount] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [flowStep, setFlowStep] = useState<FlowStep>('list');
  const [flowVisible, setFlowVisible] = useState(false);

  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [selectedTruck, setSelectedTruck] = useState<any>(null);

  const [vendors, setVendors] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);

  const [vendorSearch, setVendorSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [truckSearch, setTruckSearch] = useState('');

  const [flowFuelAmount, setFlowFuelAmount] = useState('');
  const [flowPricePerLiter, setFlowPricePerLiter] = useState('');

  // ============================ Data Fetching ==============================

  const loadData = async (silent?: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const [deliveryData, fuelData] = await Promise.all([
        fetchDeliveryOrders(),
        fetchFuelRecords(),
      ]);
      setDeliveries((deliveryData || []).filter((d: any) => !['completed', 'delivered', 'cancelled'].includes(d.status)));
      setFuelRecords(fuelData || []);
    } catch {} finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try { const data = await fetchVendors({ status: 'active' }); setVendors(data || []); } catch {}
  };

  const loadAllDrivers = async () => {
    try { const data = await fetchDrivers({ status: 'active' }); setDrivers(data || []); } catch {}
  };

  const loadAllTrucks = async () => {
    try { const data = await fetchVehicles({ status: 'active' }); setTrucks(data || []); } catch {}
  };

  // Filter drivers linked to this vendor via delivery orders, or by vendorId field.
  // Falls back to all active drivers if none matched.
  const loadDriversForVendor = async (vendor: any) => {
    try {
      const freshDeliveries = (await fetchDeliveryOrders().catch(() => [])) || [];
      const allDrivers = await fetchDrivers({ status: 'active' });
      const list = allDrivers || [];
      const nid = normalizeVendorId(vendor.id);
      const vendorOrders = freshDeliveries.filter((d: any) => normalizeVendorId(d.vendorId) === nid);
      const linkedIds = new Set(vendorOrders.map((d: any) => d.driverId).filter(Boolean));
      if (linkedIds.size > 0) { const matched = list.filter((d: any) => linkedIds.has(d.id)); if (matched.length > 0) { setDrivers(matched); return; } }
      const byField = list.filter((d: any) => d.vendorId && normalizeVendorId(d.vendorId) === nid);
      if (byField.length > 0) { setDrivers(byField); return; }
      setDrivers(list);
    } catch { loadAllDrivers(); }
  };

  // Filter trucks linked to this vendor via delivery orders, or by vendorId field.
  // Falls back to all active trucks if none matched.
  const loadTrucksForVendor = async (vendor: any) => {
    try {
      const freshDeliveries = (await fetchDeliveryOrders().catch(() => [])) || [];
      const allTrucks = await fetchVehicles({ status: 'active' });
      const list = allTrucks || [];
      const nid = normalizeVendorId(vendor.id);
      const vendorOrders = freshDeliveries.filter((d: any) => normalizeVendorId(d.vendorId) === nid);
      const linkedPlates = new Set(vendorOrders.map((d: any) => d.plateNumber).filter(Boolean));
      if (linkedPlates.size > 0) {
        const matched = list.filter((t: any) => linkedPlates.has(t.plateNumber || t.registrationNumber));
        if (matched.length > 0) { setTrucks(matched); return; }
      }
      const byVendorField = list.filter((t: any) => t.vendorId && normalizeVendorId(t.vendorId) === nid);
      if (byVendorField.length > 0) { setTrucks(byVendorField); return; }
      setTrucks(list);
    } catch { loadAllTrucks(); }
  };

  useEffect(() => { loadData(); loadVendors(); loadAllDrivers(); loadAllTrucks(); }, []);

  // ========================= Derived Lists ================================

  const getJobFuelAmount = (jobId: string): number =>
    fuelRecords.filter((f) => f.jobId === jobId).reduce((s, f) => s + (f.fuelAmount || 0), 0);
  const getJobFuelRecordCount = (jobId: string): number =>
    fuelRecords.filter((f) => f.jobId === jobId).length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deliveries.filter((d) => !q || [d.jobId, d.driverName, d.plateNumber, d.vendorName].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [deliveries, search]);

  // ====================== Delivery-Order Fuel Form ========================

  const openFuelForm = (job: any) => { setActiveJob(job); setFuelAmount(''); setPricePerLiter(''); };
  const closeFuelForm = () => { setActiveJob(null); setFuelAmount(''); setPricePerLiter(''); setSubmitting(false); };

  const handleSubmit = async () => {
    const amount = parseFloat(fuelAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert('Invalid Amount', 'Please enter a valid fuel amount.'); return; }
    setSubmitting(true);
    try {
      const price = parseFloat(pricePerLiter) || 0;
      const fuelId = generateFuelRecordId(activeJob.jobId);
      await createFuelRecord({
        fuelId, jobId: activeJob.jobId, deliveryOrderId: activeJob.id,
        driverId: activeJob.driverId, driverName: activeJob.driverName || 'N/A',
        plateNumber: activeJob.plateNumber || 'N/A',
        vendorId: activeJob.vendorId, vendorName: activeJob.vendorName || 'N/A',
        materialName: activeJob.materialName || 'N/A',
        fuelAmount: amount, pricePerLiter: price, totalCost: price > 0 ? amount * price : 0, unit: 'Litres',
        dispensedBy: user?.email || 'Fuel Operator', dispensedByEmail: user?.email || '',
        dispensedByName: user?.displayName || user?.name || 'Fuel Operator', dispensedAt: new Date().toISOString(),
      });
      Alert.alert('Fuel Dispensed', `${amount.toFixed(1)} litres recorded as ${fuelId}.`, [{ text: 'OK', onPress: () => { closeFuelForm(); loadData(); } }]);
    } catch (error: any) { Alert.alert('Error', error?.message || 'Failed to record fuel'); } finally { setSubmitting(false); }
  };

  // =========================== FAB Flow ===================================

  const openFlow = () => {
    setFlowStep('vendor'); setFlowVisible(true);
    setVendorSearch(''); setDriverSearch(''); setTruckSearch('');
    setFlowFuelAmount(''); setFlowPricePerLiter('');
    setSelectedVendor(null); setSelectedDriver(null); setSelectedTruck(null);
    loadVendors();
  };
  const closeFlow = () => { setFlowVisible(false); setFlowStep('list'); };

  const handleSelectVendor = (v: any) => {
    setSelectedVendor(v);
    setDriverSearch('');
    setTruckSearch('');
    setFlowStep('driver');
    loadDriversForVendor(v);
    loadTrucksForVendor(v);
  };
  const handleSelectDriver = (d: any) => { setSelectedDriver(d); setTruckSearch(''); setFlowStep('truck'); };
  const handleSelectTruck = (t: any) => { setSelectedTruck(t); setFlowFuelAmount(''); setFlowPricePerLiter(''); setFlowStep('form'); };

  const handleFlowSubmit = async () => {
    const amount = parseFloat(flowFuelAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert('Invalid Amount', 'Please enter a valid fuel amount.'); return; }
    if (!selectedVendor || !selectedDriver || !selectedTruck) { Alert.alert('Incomplete', 'Please select vendor, driver and truck.'); return; }
    setSubmitting(true);
    try {
      const price = parseFloat(flowPricePerLiter) || 0;
      const comboKey = `${selectedVendor.id}-${selectedDriver.id}-${selectedTruck.id}`;
      const seq = nextFuelSeq(comboKey);
      const fuelId = buildFuelId(selectedVendor.id, selectedDriver.id, selectedTruck.id, seq);
      await createFuelRecord({
        fuelId, jobId: null, deliveryOrderId: null,
        driverId: selectedDriver.id, driverName: selectedDriver.name || selectedDriver.fullName || 'N/A',
        plateNumber: selectedTruck.plateNumber || selectedTruck.registrationNumber || selectedTruck.id || 'N/A',
        vendorId: selectedVendor.id, vendorName: selectedVendor.name || selectedVendor.companyName || 'N/A',
        materialName: 'N/A', fuelAmount: amount, pricePerLiter: price,
        totalCost: price > 0 ? amount * price : 0, unit: 'Litres',
        dispensedBy: user?.email || 'Fuel Operator', dispensedByEmail: user?.email || '',
        dispensedByName: user?.displayName || user?.name || 'Fuel Operator', dispensedAt: new Date().toISOString(),
      });
      Alert.alert('Fuel Dispensed', `${amount.toFixed(1)} litres recorded as ${fuelId}.`, [{ text: 'OK', onPress: () => { closeFlow(); loadData(); } }]);
    } catch (error: any) { Alert.alert('Error', error?.message || 'Failed to record fuel'); } finally { setSubmitting(false); }
  };

  // ======================= Filtered Lists =================================

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return vendors.filter((v) => !q || (v.name || v.companyName || '').toLowerCase().includes(q) || (v.id || '').toLowerCase().includes(q));
  }, [vendors, vendorSearch]);
  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    return drivers.filter((d) => !q || (d.name || d.fullName || '').toLowerCase().includes(q) || (d.id || '').toLowerCase().includes(q));
  }, [drivers, driverSearch]);
  const filteredTrucks = useMemo(() => {
    const q = truckSearch.trim().toLowerCase();
    return trucks.filter((t) => !q || (t.plateNumber || t.registrationNumber || t.id || '').toLowerCase().includes(q) || (t.make || t.model || '').toLowerCase().includes(q));
  }, [trucks, truckSearch]);

  // ======================== Render: Fuel Form =============================

  if (activeJob) {
    const amt = getJobFuelAmount(activeJob.jobId || activeJob.id);
    const cnt = getJobFuelRecordCount(activeJob.jobId || activeJob.id);
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View  style={{ display: 'none' }}>

        <View style={[styles.jobCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.jobCardHeader}><View style={{ flex: 1 }}><Text style={[styles.jobCardTitle, { color: colors.text }]}>{activeJob.jobId}</Text></View></View>
          <DetailRow icon="person-outline" value={`Driver: ${activeJob.driverName || 'N/A'}`} />
          <DetailRow icon="car-outline" value={`Truck: ${activeJob.plateNumber || 'N/A'}`} />
          <DetailRow icon="business-outline" value={`Vendor: ${activeJob.vendorName || 'N/A'}`} />
          {amt > 0 && (<View style={[styles.existingFuel, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' }]}><Ionicons name="water" size={16} color="#F59E0B" /><Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>{amt.toFixed(1)} L already dispensed ({cnt} record{cnt !== 1 ? 's' : ''})</Text></View>)}
        </View>
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.inputHeader}><View style={[styles.inputIcon, { backgroundColor: '#F59E0B15' }]}><Ionicons name="water-outline" size={22} color="#F59E0B" /></View><View style={{ flex: 1 }}><Text style={[styles.inputTitle, { color: colors.text }]}>Fuel Amount</Text><Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter fuel amount in litres.</Text></View></View>
          <View style={[styles.fuelInputWrap, { borderColor: '#F59E0B', backgroundColor: colors.inputBg }]}><TextInput style={[styles.fuelInput, { color: colors.text }]} placeholder="0.0" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" value={fuelAmount} onChangeText={setFuelAmount} autoFocus /><Text style={[styles.fuelSuffix, { color: colors.textMuted }]}>Litres</Text></View>
        </View>
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.inputHeader}><View style={[styles.inputIcon, { backgroundColor: '#10B98115' }]}><Ionicons name="cash-outline" size={22} color="#10B981" /></View><View style={{ flex: 1 }}><Text style={[styles.inputTitle, { color: colors.text }]}>Price per Litre</Text><Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter price per litre (KES).</Text></View></View>
          <View style={[styles.fuelInputWrap, { borderColor: '#10B981', backgroundColor: colors.inputBg }]}><TextInput style={[styles.fuelInput, { color: colors.text }]} placeholder="0.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" value={pricePerLiter} onChangeText={setPricePerLiter} /><Text style={[styles.fuelSuffix, { color: colors.textMuted }]}>KES/L</Text></View>
          {fuelAmount && pricePerLiter ? (<View style={{ marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}><Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Total Cost:</Text><Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>KES {(parseFloat(fuelAmount) * parseFloat(pricePerLiter)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></View>) : null}
        </View>
        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: fuelAmount && !submitting ? '#F59E0B' : colors.border }]} onPress={handleSubmit} disabled={submitting || !fuelAmount || parseFloat(fuelAmount) <= 0}>
          {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}<Text style={styles.submitBtnText}>{submitting ? 'Dispensing...' : 'Dispense Fuel'}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={closeFuelForm} disabled={submitting}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ================== Render: List + FAB + Modal ==========================

  const flowTitle = () => ({ vendor: 'Select Vendor', driver: 'Select Driver', truck: 'Select Truck', form: 'Dispense Fuel', list: '' }[flowStep] || '');
  const flowSubtitle = () => {
    switch (flowStep) {
      case 'vendor': return 'Choose a vendor for fuel dispensing.';
      case 'driver': return 'Choose the driver linked to this vendor.';
      case 'truck': return 'Choose the truck linked to this vendor.';
      case 'form': return `Vendor: ${selectedVendor?.name || selectedVendor?.companyName || 'N/A'}  ·  Driver: ${selectedDriver?.name || selectedDriver?.fullName || 'N/A'}  ·  Truck: ${selectedTruck?.plateNumber || selectedTruck?.registrationNumber || selectedTruck?.id || 'N/A'}`;
      default: return '';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={colors.primary} />}>
         <Text style={[{ color: colors.textMuted }]}>Select a Vendor - Driver - Truck to dispense fuel</Text>
        {loading ? (<DataCard><Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text></DataCard>) : filtered.length ? (filtered.map((item) => {
          const amt = getJobFuelAmount(item.jobId || item.id); const cnt = getJobFuelRecordCount(item.jobId || item.id);
          return (<DataCard  style={{ display: 'none' }} key={item.id} onPress={() => openFuelForm(item)}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.jobId}</Text></View></View><DetailRow icon="person-outline" value={`Driver: ${item.driverName || 'N/A'}`} /><DetailRow icon="car-outline" value={`Truck: ${item.plateNumber || 'N/A'}`} /><DetailRow icon="business-outline" value={`Vendor: ${item.vendorName || 'N/A'}`} />{amt > 0 && (<View style={[styles.fuelInfo, { backgroundColor: '#F59E0B10' }]}><Ionicons name="water" size={14} color="#F59E0B" /><Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>{amt.toFixed(1)} L dispensed ({cnt} record{cnt !== 1 ? 's' : ''})</Text></View>)}<View style={[styles.tapHint, { backgroundColor: `${colors.primary}08` }]}><Ionicons name="hand-left-outline" size={12} color={colors.primary} /><Text style={[styles.tapHintText, { color: colors.primary }]}>Tap to dispense fuel</Text></View><Text style={{ fontSize: 12, color: colors.textTertiary }}>{formatEAT(item.updatedAt || item.createdAt)}</Text></DataCard>);
        })) : (<EmptyState icon="water-outline" title="No trucks" subtitle="No matching jobs found." />)}
      </PageShell>
      <TouchableOpacity style={[styles.fab, { backgroundColor: '#F59E0B' }]} onPress={openFlow} activeOpacity={0.86}><Ionicons name="add" size={32} color="#FFFFFF" /></TouchableOpacity>
      <Modal visible={flowVisible} transparent animationType="slide" onRequestClose={closeFlow}>
        <View style={styles.modalBackdrop}><View style={[styles.flowSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.flowHead}><View style={{ flex: 1 }}><Text style={[styles.sheetTitle, { color: colors.text }]}>{flowTitle()}</Text><Text style={[styles.sheetSub, { color: colors.textMuted }]} numberOfLines={2}>{flowSubtitle()}</Text></View><TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.inputBg }]} onPress={closeFlow}><Ionicons name="close" size={20} color={colors.textSecondary} /></TouchableOpacity></View>
          <View style={styles.stepRow}>{(['vendor', 'driver', 'truck', 'form'] as FlowStep[]).map((s, idx) => {
            const completed = (s === 'vendor' && ['driver', 'truck', 'form'].includes(flowStep)) || (s === 'driver' && ['truck', 'form'].includes(flowStep)) || (s === 'truck' && flowStep === 'form');
            return (<React.Fragment key={s}><View style={[styles.stepDot, completed ? { backgroundColor: '#10B981' } : flowStep === s ? { backgroundColor: '#F59E0B' } : { backgroundColor: colors.border }]} />{idx < 3 && <View style={[styles.stepLine, completed ? { backgroundColor: '#10B981' } : { backgroundColor: colors.border }]} />}</React.Fragment>);
          })}</View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md }} keyboardShouldPersistTaps="handled">
            {flowStep === 'vendor' && (<><View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}><Ionicons name="search-outline" size={18} color={colors.textMuted} /><TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search vendors..." placeholderTextColor={colors.textTertiary} value={vendorSearch} onChangeText={setVendorSearch} /></View>{filteredVendors.length ? filteredVendors.map((v) => (<TouchableOpacity key={v.id} style={[styles.selectCard, { borderColor: colors.border }]} onPress={() => handleSelectVendor(v)}><View style={[styles.selectIconCircle, { backgroundColor: '#F59E0B15' }]}><Ionicons name="business-outline" size={20} color="#F59E0B" /></View><View style={{ flex: 1 }}><Text style={[styles.selectTitle, { color: colors.text }]}>{v.name || v.companyName || v.id}</Text><Text style={[styles.selectSub, { color: colors.textMuted }]}>{v.id} {v.email ? `· ${v.email}` : ''}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textTertiary} /></TouchableOpacity>)) : <EmptyState icon="business-outline" title="No vendors" subtitle="No active vendors found." />}</>)}
            {flowStep === 'driver' && (<><View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}><TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => setFlowStep('vendor')}><Ionicons name="arrow-back" size={18} color={colors.textSecondary} /><Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text></TouchableOpacity><View style={[styles.chip, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }]}><Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>{selectedVendor?.name || selectedVendor?.companyName || selectedVendor?.id}</Text></View></View><View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}><Ionicons name="search-outline" size={18} color={colors.textMuted} /><TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search drivers..." placeholderTextColor={colors.textTertiary} value={driverSearch} onChangeText={setDriverSearch} /></View>{filteredDrivers.length ? filteredDrivers.map((d) => (<TouchableOpacity key={d.id} style={[styles.selectCard, { borderColor: colors.border }]} onPress={() => handleSelectDriver(d)}><View style={[styles.selectIconCircle, { backgroundColor: '#3B82F615' }]}><Ionicons name="person-outline" size={20} color="#3B82F6" /></View><View style={{ flex: 1 }}><Text style={[styles.selectTitle, { color: colors.text }]}>{d.name || d.fullName || d.id}</Text><Text style={[styles.selectSub, { color: colors.textMuted }]}>{d.id} {d.phone ? `· ${d.phone}` : ''}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textTertiary} /></TouchableOpacity>)) : <EmptyState icon="person-outline" title="No drivers" subtitle="No drivers linked to this vendor." />}</>)}
            {flowStep === 'truck' && (<><View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}><TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => setFlowStep('driver')}><Ionicons name="arrow-back" size={18} color={colors.textSecondary} /><Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text></TouchableOpacity><View style={[styles.chip, { backgroundColor: '#3B82F615', borderColor: '#3B82F630' }]}><Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>{selectedDriver?.name || selectedDriver?.fullName || selectedDriver?.id}</Text></View></View><View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}><Ionicons name="search-outline" size={18} color={colors.textMuted} /><TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search trucks..." placeholderTextColor={colors.textTertiary} value={truckSearch} onChangeText={setTruckSearch} /></View>{filteredTrucks.length ? filteredTrucks.map((t) => (<TouchableOpacity key={t.id} style={[styles.selectCard, { borderColor: colors.border }]} onPress={() => handleSelectTruck(t)}><View style={[styles.selectIconCircle, { backgroundColor: '#10B98115' }]}><Ionicons name="car-outline" size={20} color="#10B981" /></View><View style={{ flex: 1 }}><Text style={[styles.selectTitle, { color: colors.text }]}>{t.plateNumber || t.registrationNumber || t.id}</Text><Text style={[styles.selectSub, { color: colors.textMuted }]}>{t.make || ''} {t.model || ''} {t.id ? `· ${t.id}` : ''}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textTertiary} /></TouchableOpacity>)) : <EmptyState icon="car-outline" title="No trucks" subtitle="No trucks linked to this vendor." />}</>)}
            {flowStep === 'form' && (<><View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}><TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => setFlowStep('truck')}><Ionicons name="arrow-back" size={18} color={colors.textSecondary} /><Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text></TouchableOpacity><View style={[styles.chip, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}><Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>{selectedTruck?.plateNumber || selectedTruck?.registrationNumber || selectedTruck?.id}</Text></View></View><View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.inputHeader}><View style={[styles.inputIcon, { backgroundColor: '#F59E0B15' }]}><Ionicons name="water-outline" size={22} color="#F59E0B" /></View><View style={{ flex: 1 }}><Text style={[styles.inputTitle, { color: colors.text }]}>Fuel Amount</Text><Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter fuel amount in litres.</Text></View></View><View style={[styles.fuelInputWrap, { borderColor: '#F59E0B', backgroundColor: colors.inputBg }]}><TextInput style={[styles.fuelInput, { color: colors.text }]} placeholder="0.0" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" value={flowFuelAmount} onChangeText={setFlowFuelAmount} autoFocus /><Text style={[styles.fuelSuffix, { color: colors.textMuted }]}>Litres</Text></View></View><View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.inputHeader}><View style={[styles.inputIcon, { backgroundColor: '#10B98115' }]}><Ionicons name="cash-outline" size={22} color="#10B981" /></View><View style={{ flex: 1 }}><Text style={[styles.inputTitle, { color: colors.text }]}>Price per Litre</Text><Text style={[styles.inputSub, { color: colors.textMuted }]}>Enter price per litre (KES).</Text></View></View><View style={[styles.fuelInputWrap, { borderColor: '#10B981', backgroundColor: colors.inputBg }]}><TextInput style={[styles.fuelInput, { color: colors.text }]} placeholder="0.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" value={flowPricePerLiter} onChangeText={setFlowPricePerLiter} /><Text style={[styles.fuelSuffix, { color: colors.textMuted }]}>KES/L</Text></View>{flowFuelAmount && flowPricePerLiter ? (<View style={{ marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}><Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Total Cost:</Text><Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>KES {(parseFloat(flowFuelAmount) * parseFloat(flowPricePerLiter)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></View>) : null}</View><TouchableOpacity style={[styles.submitBtn, { backgroundColor: flowFuelAmount && !submitting ? '#F59E0B' : colors.border }]} onPress={handleFlowSubmit} disabled={submitting || !flowFuelAmount || parseFloat(flowFuelAmount) <= 0}>{submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}<Text style={styles.submitBtnText}>{submitting ? 'Dispensing...' : 'Dispense Fuel'}</Text></TouchableOpacity></>)}
            <View style={{ height: Spacing.xl }} />
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1 }, formContent: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  jobCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  jobCardTitle: { fontSize: 18, fontWeight: '800' },
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  inputIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  inputTitle: { fontSize: 16, fontWeight: '700' }, inputSub: { fontSize: 12, marginTop: 2 },
  fuelInputWrap: { borderRadius: Radius.md, borderWidth: 2, paddingHorizontal: Spacing.md, height: 64, flexDirection: 'row', alignItems: 'center' },
  fuelInput: { flex: 1, fontSize: 28, fontWeight: '800' }, fuelSuffix: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm, minHeight: 50, marginTop: Spacing.sm },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm },
  cancelText: { fontSize: 14, fontWeight: '600' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1 },
  backText: { fontSize: 13, fontWeight: '600' },
  tapHint: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, marginTop: 6 },
  tapHintText: { fontSize: 11, fontWeight: '700' },
  fuelInfo: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  existingFuel: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1 },
  fab: { position: 'absolute', right: Spacing.xl, bottom: Spacing.xl, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, zIndex: 100 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  flowSheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, maxHeight: '90%' },
  flowHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.sm },
  sheetTitle: { fontSize: 18, fontWeight: '900' }, sheetSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  iconButton: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, gap: 0 },
  stepDot: { width: 10, height: 10, borderRadius: 5 }, stepLine: { width: 36, height: 3, borderRadius: 2 },
  searchWrap: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  searchInput: { flex: 1, height: 46, fontSize: 14, fontWeight: '700' },
  selectCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md },
  selectIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  selectTitle: { fontSize: 15, fontWeight: '700' }, selectSub: { fontSize: 12, marginTop: 2 },
});