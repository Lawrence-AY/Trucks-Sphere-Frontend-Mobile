import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Image, Platform, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useRealtimeCollection } from '../store/realtimeData';
import { useRealTimeSyncStore } from '../store/realTimeSyncStore';
import { receiveStoreDelivery, inspectStoreDelivery } from '../services/api';
import { uploadReceivingPhoto } from '../services/uploadService';
import { formatStoreQuantity, isStoreIncoming, isStorePendingInspection, receivingLines, receivingDate, storeMaterialUnit } from '../utils/storeReceiving';
import { STOREMAN_GENERAL_METRICS, storemanInspectionReady } from '../utils/storemanInspection';
import { InspectionChoice } from './InspectionChoice';
import { SearchField } from './EnterpriseUI';
import { StoreReceiptDetails } from './StoreReceiptDetails';
import { CommandHeader, PageShell } from './EnterpriseUI';
import { BackButton } from './ui/BackButton';
import { TripListCard } from './TripListCard';

export default function StoreReceivingWorkflow({ inspection = false }: { inspection?: boolean }) {
  const colors = useTheme();
  const navigation = useNavigation();
  const { data: jobs, error: deliveryError } = useRealtimeCollection('deliveryOrders');
  const params = useLocalSearchParams<{ id?: string; jobId?: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(params.id || params.jobId || null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const requestId = useRef('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const uploaded = useRef<Record<number, string>>({});
  const [decision, setDecision] = useState<'Pass' | 'Failed' | undefined>();
  const [reason, setReason] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [accepted, setAccepted] = useState<Record<number, string>>({});
  const [rejected, setRejected] = useState<Record<number, string>>({});
  const [failureReasons, setFailureReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const refresh = useRealTimeSyncStore(state => state.refresh);
  const eligible = inspection ? isStorePendingInspection : isStoreIncoming;
  const selected = jobs.find(job => job.id === selectedId || job.jobId === selectedId);
  const lines = selected
    ? receivingLines(selected).map((line, index) => ({
        ...line,
        sourceUnit: line.measurementType || line.defaultUnit || line.unit || selected.unit || '',
        unit: storeMaterialUnit(line, selected.storeReceiving?.materialReceipts?.[index]?.unit || selected.unit),
      }))
    : [];
  const queue = jobs.filter(eligible).filter(job => !search.trim() || [job.jobId, job.poNumber, job.vendorName, job.driverName, job.plateNumber, ...receivingLines(job).map(line => line.materialName)].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));
  const reset = () => { setSelectedId(null); setQuantities({}); setPhotos({}); uploaded.current = {}; setDecision(undefined); setReason(''); setDeliveredBy(''); setChecks({}); setAccepted({}); setRejected({}); setFailureReasons({}); requestId.current = ''; setError(''); };
  useLayoutEffect(() => {
    if (selectedId) {
      navigation.setOptions({ headerShown: true, headerTitle: selected?.jobId || (inspection ? 'Inspection' : 'Receiving'), headerLeft: () => <BackButton onPress={reset} /> });
    } else {
      navigation.setOptions({ headerLeft: undefined, headerTitle: inspection ? 'Inspection' : 'Receiving' });
    }
  }, [navigation, inspection, selectedId, selected?.jobId]);
  const photoFor = (index: number) => photos[index] || selected?.receivingEvidence?.find((photo: any) => photo.lineIndex === index)?.url;
  const decisionReady = inspection ? storemanInspectionReady(decision, checks, reason) : decision === 'Pass' || (decision === 'Failed' && Boolean(reason.trim()));
  const ready = Boolean(selected && eligible(selected) && decisionReady && (inspection
    ? lines.every((_, index) => { const yes = Number(accepted[index]); const no = Number(rejected[index]); return accepted[index]?.trim() && rejected[index]?.trim() && Number.isFinite(yes) && Number.isFinite(no) && yes >= 0 && no >= 0 && yes + no > 0 && (no === 0 || Boolean(failureReasons[index]?.trim())); })
    : (Boolean(deliveredBy.trim() || selected.driverName) && lines.every((_, index) => quantities[index]?.trim() && Number.isFinite(Number(quantities[index])) && Number(quantities[index]) >= 0 && photoFor(index)))));
  const pickPhoto = async (index: number, source: 'camera' | 'library' = 'camera') => {
    try {
      const permission = Platform.OS === 'web' ? { granted: true } : source === 'library'
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { setError(source === 'library' ? 'Photo library permission is needed to upload a material photo.' : 'Camera permission is needed to capture the material photo.'); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: .75 };
      const result = Platform.OS === 'web' || source === 'library' ? await ImagePicker.launchImageLibraryAsync(options) : await ImagePicker.launchCameraAsync(options);
      if (!result.canceled && result.assets[0]?.uri) { setPhotos(current => ({ ...current, [index]: result.assets[0].uri })); delete uploaded.current[index]; }
    } catch (err: any) { setError(err.message || 'Could not capture photo.'); }
  };
  const save = async () => {
    if (inspection && selected) {
      for (let index = 0; index < lines.length; index++) {
        const acceptedValue = Number(accepted[index]);
        const rejectedValue = Number(rejected[index]);
        const receivedValue = Number(selected.storeReceiving?.materialReceipts?.[index]?.receivedQuantity);
        if (accepted[index]?.trim() && rejected[index]?.trim() && Number.isFinite(acceptedValue) && Number.isFinite(rejectedValue) && Number.isFinite(receivedValue) && acceptedValue + rejectedValue > receivedValue) {
          const unit = lines[index].unit;
          Alert.alert(
            'Inspection quantity exceeds received',
            `${lines[index].materialName || 'Material'} has ${formatStoreQuantity(acceptedValue + rejectedValue, unit)} ${unit} accepted and rejected, but only ${formatStoreQuantity(receivedValue, unit)} ${unit} was recorded as received.`,
          );
          return;
        }
      }
    }
    if (!ready || !selected || !decision || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    requestId.current ||= `store_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      if (!inspection) {
        for (let index = 0; index < lines.length; index++) {
          if (photos[index] && !uploaded.current[index]) uploaded.current[index] = (await uploadReceivingPhoto(selected.id, photos[index], index)).photoURL;
        }
      }
      const saved = inspection
        ? await inspectStoreDelivery(selected.id, { requestId: requestId.current, result: decision, qualityChecks: checks, reason, lineDecisions: lines.map((line, index) => ({ acceptedQuantity: Number(accepted[index]), rejectedQuantity: Number(rejected[index]), unit: line.unit, failureReason: failureReasons[index] || '' })) })
        : await receiveStoreDelivery(selected.id, { requestId: requestId.current, quantities: lines.map((_, index) => quantities[index]), units: lines.map(line => line.unit), condition: decision, reason, deliveredByName: deliveredBy.trim() || selected.driverName || '' });
      useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', saved);
      if (saved.receivingStatus === 'inventory_added') void refresh('purchaseOrders').catch(() => {});
      if (saved.receivingStatus === 'inventory_added') void refresh('purchaseOrders').catch(() => {});
      if (decision === 'Failed') Alert.alert(inspection ? 'Inspection rejected' : 'Delivery rejected', inspection ? 'The delivery has been rejected and flagged.' : 'Delivery rejected and flagged. No inventory added.');
      else if (inspection) Alert.alert('Inspection passed', 'Materials added to inventory.');
      else Alert.alert('Receiving saved', 'This delivery is now pending inspection.');
      reset();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err.message || 'Could not save. Your entries have been kept for retry.');
    }
    finally { savingRef.current = false; setSaving(false); }
  };
  const card = { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16 };
  const input = { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 };
  return <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await refresh('deliveryOrders'); } finally { setRefreshing(false); } }} />}>
    <CommandHeader title={inspection ? 'Material quality inspection' : 'Receive store materials'} subtitle={inspection ? '' : ''} />
    {deliveryError ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginVertical: 10 }}>Could not load deliveries: {deliveryError}. Please sign in again or contact an administrator.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginVertical: 10 }}>{error}</Text> : null}
    {selectedId ? <>
      {!selected ? <Text style={{ color: colors.textMuted }}>Loading delivery details. Pull to refresh if needed.</Text> : !eligible(selected) ? <View style={{ gap: 10 }}><View style={[card, { gap: 6 }]}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 19 }}>{selected.jobId || selected.id}</Text><Text style={{ color: colors.textMuted }}>PO: {selected.poNumber || selected.purchaseOrderId || '—'} · Vendor: {selected.vendorName || '—'}</Text><Text style={{ color: colors.textMuted }}>Driver: {selected.driverName || '—'} · Truck: {selected.plateNumber || '—'}</Text><Text style={{ color: colors.textMuted }}>Received {receivingDate(selected.storeReceiving?.receivedAt)}</Text></View><View style={card}><Text style={{ color: colors.text, marginBottom: 10 }}>This delivery has already moved out of this queue.</Text>{selected.storeReceiving ? <StoreReceiptDetails job={selected} hideReceived /> : null}</View></View> : <>
        <View style={[card, { flexDirection: 'column', gap: 6 }]}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 19 }}>{selected.jobId || selected.id}</Text></View><Text style={{ color: colors.textMuted, marginTop: 2 }}>PO: {selected.poNumber || selected.purchaseOrderId || '—'} · Vendor: {selected.vendorName || '—'}</Text><Text style={{ color: colors.textMuted, marginTop: 2 }}>Driver: {selected.driverName || '—'} · Truck: {selected.plateNumber || '—'}</Text><Text style={{ color: colors.textMuted, marginTop: 2 }}>Received {receivingDate(selected.storeReceiving?.receivedAt)}</Text></View>
        {inspection ? <View style={[card, { padding: 8 }]}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>Received at store</Text><StoreReceiptDetails job={selected} hideMeta hideReceived compact /><Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 4 }}>Accepted &amp; Rejected quantities</Text>
          {lines.map((line, index) => <View key={`split-${index}`} style={{ marginTop: 4, gap: 3 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || 'Material'} · Store count in {line.unit}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: colors.textMuted, width: 110 }}>{`Accepted ${line.unit}`}</Text>
              <TextInput editable={!saving} keyboardType="decimal-pad" placeholder={`Accepted ${line.unit}`} placeholderTextColor={colors.textMuted} value={accepted[index] ?? ''} onChangeText={value => setAccepted(current => ({ ...current, [index]: value }))} style={[input, { flex: 1, marginTop: 0, padding: 9 }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: colors.textMuted, width: 110 }}>{`Rejected ${line.unit}`}</Text>
              <TextInput editable={!saving} keyboardType="decimal-pad" placeholder={`Rejected ${line.unit}`} placeholderTextColor={colors.textMuted} value={rejected[index] ?? ''} onChangeText={value => setRejected(current => ({ ...current, [index]: value }))} style={[input, { flex: 1, marginTop: 0, padding: 9 }]} />
            </View>
            {Number(rejected[index] ?? 0) > 0 ? <TextInput editable={!saving} multiline placeholder="Failure reason for rejected quantity *" placeholderTextColor={colors.textMuted} value={failureReasons[index] || ''} onChangeText={value => setFailureReasons(current => ({ ...current, [index]: value }))} style={[input, { marginTop: 4 }]} /> : null}
          </View>)}
        </View> : <>
          {lines.map((line, index) => <View key={index} style={card}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || line.productName || 'Material'}</Text>
            {String(line.sourceUnit).trim().toLowerCase() === String(line.unit).trim().toLowerCase() ? <Text style={{ color: colors.textMuted, marginTop: 8 }}>Expected at store: {line.quantity ?? '—'} {line.unit}</Text> : null}
            <TextInput accessibilityLabel={`Received ${line.unit} for ${line.materialName || 'material'}`} editable={!saving} inputAccessoryViewID="trucksphere-keyboard-done" placeholder={`Actual ${line.unit} received *`} placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={quantities[index] || ''} onChangeText={value => setQuantities(current => ({ ...current, [index]: value }))} style={input} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={photoFor(index) ? 'Replace material photo' : 'Capture material photo'} disabled={saving} onPress={() => void pickPhoto(index, 'camera')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }}><Ionicons name="camera-outline" size={18} color={colors.onPrimary} /><Text style={{ color: colors.onPrimary, fontWeight: '800' }}>{photoFor(index) ? 'Replace photo' : 'Capture material photo *'}</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Upload material photo from device" disabled={saving} onPress={() => void pickPhoto(index, 'library')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, opacity: saving ? 0.6 : 1 }}><Ionicons name="image-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '800' }}>Upload from device</Text></TouchableOpacity>
            </View>
            {photoFor(index) ? <Image source={{ uri: photoFor(index) }} accessibilityLabel="Material evidence" resizeMode="contain" style={{ width: '100%', height: 180 }} /> : null}
          </View>)}
          <TextInput accessibilityLabel="Personnel who delivered the materials" editable={!saving} placeholder={`Delivered by (defaults to ${selected.driverName || 'driver'})`} placeholderTextColor={colors.textMuted} value={deliveredBy} onChangeText={setDeliveredBy} style={input} />
        </>}
        <View style={card}>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 12 }}>{inspection ? 'Quality decision' : 'Initial condition'}</Text>
          <InspectionChoice label={inspection ? 'Quality inspection' : 'Initial receiving condition'} value={decision} onChange={setDecision} disabled={saving} />
          {inspection && decision === 'Pass' ? <View style={{ marginTop: 12 }}><Text style={{ color: colors.text, fontWeight: '700' }}>General quality metrics</Text>{STOREMAN_GENERAL_METRICS.map(metric => <TouchableOpacity key={metric} accessibilityRole="checkbox" accessibilityLabel={metric} accessibilityState={{ checked: checks[metric] === true, disabled: saving }} disabled={saving} onPress={() => setChecks(current => ({ ...current, [metric]: !current[metric] }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}><Ionicons name={checks[metric] ? 'checkbox' : 'square-outline'} size={24} color={checks[metric] ? colors.success : colors.textMuted} /><Text style={{ color: colors.text, flex: 1 }}>{metric}</Text></TouchableOpacity>)}</View> : null}
          {decision === 'Failed' ? <TextInput accessibilityLabel="Rejection reason" editable={!saving} multiline placeholder="Rejection reason *" placeholderTextColor={colors.textMuted} value={reason} onChangeText={setReason} style={input} /> : null}
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !ready || saving }} disabled={!ready || saving} onPress={() => void save()} style={{ backgroundColor: decision === 'Failed' ? colors.danger : colors.primary, opacity: ready && !saving ? 1 : .5, borderRadius: 8, padding: 16, marginTop: 16, alignItems: 'center' }}><Text style={{ color: colors.onPrimary, fontWeight: '800' }}>{saving ? 'Saving…' : decision === 'Failed' ? 'Reject and flag delivery' : inspection ? 'Approve inspection & add inventory' : 'Save receiving · Pending Inspection'}</Text></TouchableOpacity>
      </>}
    </> : <>
      <SearchField title={inspection ? 'Pending Inspection' : 'Incoming deliveries'} icon={inspection ? 'checkbox-outline' : 'cube-outline'} value={search} onChangeText={setSearch} placeholder="Search job, PO, vendor, truck or material" />
      <Text style={{ color: colors.textMuted, marginTop: 12 }}>{queue.length} {inspection ? 'awaiting inspection' : 'awaiting receiving'}</Text>
      {!queue.length ? <Text style={{ color: colors.textMuted, paddingVertical: 24 }}>{inspection ? 'No materials pending inspection.' : 'No incoming deliveries.'}</Text> : <View style={{ gap: 6 }}>{queue.map(job => <TripListCard key={job.id} trip={{ ...job, updatedAt: inspection ? job.storeReceiving?.receivedAt || job.updatedAt : job.updatedAt }} storeReceivingLayout storeReceivedQuantities={inspection} onPress={() => { reset(); setSelectedId(job.id); }} />)}</View>}
    </>}
  </PageShell>;
}
