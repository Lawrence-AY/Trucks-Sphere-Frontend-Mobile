import { useRef, useState } from 'react';
import { Image, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useDeliveryOrders } from '../store/realtimeData';
import { useRealTimeSyncStore } from '../store/realTimeSyncStore';
import { receiveStoreDelivery, inspectStoreDelivery } from '../services/api';
import { uploadReceivingPhoto } from '../services/uploadService';
import { isStoreIncoming, isStorePendingInspection, receivingLines, receivingDate } from '../utils/storeReceiving';
import { STOREMAN_GENERAL_METRICS, storemanInspectionReady } from '../utils/storemanInspection';
import { InspectionChoice } from './InspectionChoice';
import { SearchField } from './EnterpriseUI';
import { StoreReceiptDetails } from './StoreReceiptDetails';

export default function StoreReceivingWorkflow({ inspection = false }: { inspection?: boolean }) {
  const colors = useTheme();
  const jobs = useDeliveryOrders();
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const refresh = useRealTimeSyncStore(state => state.refresh);
  const eligible = inspection ? isStorePendingInspection : isStoreIncoming;
  const selected = jobs.find(job => job.id === selectedId || job.jobId === selectedId);
  const lines = selected ? receivingLines(selected) : [];
  const queue = jobs.filter(eligible).filter(job => !search.trim() || [job.jobId, job.poNumber, job.vendorName, job.driverName, job.plateNumber, ...receivingLines(job).map(line => line.materialName)].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));
  const reset = () => { setSelectedId(null); setQuantities({}); setPhotos({}); uploaded.current = {}; setDecision(undefined); setReason(''); setDeliveredBy(''); setChecks({}); requestId.current = ''; setError(''); };
  const photoFor = (index: number) => photos[index] || selected?.receivingEvidence?.find((photo: any) => photo.lineIndex === index)?.url;
  const decisionReady = inspection ? storemanInspectionReady(decision, checks, reason) : decision === 'Pass' || (decision === 'Failed' && Boolean(reason.trim()));
  const ready = Boolean(selected && eligible(selected) && decisionReady && (inspection || (Boolean(deliveredBy.trim() || selected.driverName) && lines.every((_, index) => quantities[index]?.trim() && Number.isFinite(Number(quantities[index])) && Number(quantities[index]) >= 0 && photoFor(index)))));
  const pickPhoto = async (index: number) => {
    try {
      const permission = Platform.OS === 'web' ? { granted: true } : await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { setError('Camera permission is needed to capture the material photo.'); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: .75 };
      const result = Platform.OS === 'web' ? await ImagePicker.launchImageLibraryAsync(options) : await ImagePicker.launchCameraAsync(options);
      if (!result.canceled && result.assets[0]?.uri) { setPhotos(current => ({ ...current, [index]: result.assets[0].uri })); delete uploaded.current[index]; }
    } catch (err: any) { setError(err.message || 'Could not capture photo.'); }
  };
  const save = async () => {
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
        ? await inspectStoreDelivery(selected.id, { requestId: requestId.current, result: decision, qualityChecks: checks, reason })
        : await receiveStoreDelivery(selected.id, { requestId: requestId.current, quantities: lines.map((_, index) => quantities[index]), condition: decision, reason, deliveredByName: deliveredBy.trim() || selected.driverName || '' });
      useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', saved);
      if (saved.receivingStatus === 'inventory_added') void refresh('purchaseOrders').catch(() => {});
      setMessage(decision === 'Failed' ? 'Delivery rejected and flagged. No inventory added.' : inspection ? 'Inspection passed. Materials added to inventory.' : 'Receiving saved. This delivery is now Pending Inspection.');
      reset();
    } catch (err: any) { setError(err?.response?.data?.error || err.message || 'Could not save. Your entries have been kept for retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const card = { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 12 };
  const input = { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 };
  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingBottom: 48, maxWidth: 960, width: '100%', alignSelf: 'center' }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await refresh('deliveryOrders'); } finally { setRefreshing(false); } }} />}>
    <Text style={{ color: colors.text, fontSize: 25, fontWeight: '800' }}>{inspection ? 'Quality Inspection' : 'Store Receiving'}</Text>
    <Text style={{ color: colors.textMuted, marginVertical: 10 }}>{inspection ? 'Review the received materials and photo evidence before approving inventory.' : 'Count materials, record their initial condition, and capture a photo for each material.'}</Text>
    {message ? <Text accessibilityRole="alert" style={{ color: colors.success, marginVertical: 10 }}>{message}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginVertical: 10 }}>{error}</Text> : null}
    {selectedId ? <>
      <TouchableOpacity disabled={saving} onPress={reset}><Text style={{ color: colors.primary, paddingVertical: 12 }}>← Back to {inspection ? 'inspection queue' : 'receiving'}</Text></TouchableOpacity>
      {!selected ? <Text style={{ color: colors.textMuted }}>Loading delivery details. Pull to refresh if needed.</Text> : !eligible(selected) ? <View style={card}><Text style={{ color: colors.text }}>This delivery has already moved out of this queue.</Text>{selected.storeReceiving ? <StoreReceiptDetails job={selected} /> : null}</View> : <>
        <View style={card}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 19 }}>{selected.jobId || selected.id}</Text><Text style={{ color: colors.textMuted, marginTop: 8 }}>PO: {selected.poNumber || selected.purchaseOrderId || '—'} · Vendor: {selected.vendorName || '—'}</Text><Text style={{ color: colors.textMuted, marginTop: 8 }}>Driver: {selected.driverName || '—'} · Truck: {selected.plateNumber || '—'}</Text></View>
        {inspection ? <View style={card}><StoreReceiptDetails job={selected} /></View> : <>
          {lines.map((line, index) => <View key={index} style={card}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || line.productName || 'Material'}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>Dispatched: {line.quantity ?? '—'} {line.unit || ''}</Text>
            <TextInput accessibilityLabel={`Received quantity for ${line.materialName || 'material'}`} editable={!saving} inputAccessoryViewID="trucksphere-keyboard-done" placeholder="Received quantity *" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={quantities[index] || ''} onChangeText={value => setQuantities(current => ({ ...current, [index]: value }))} style={input} />
            <TouchableOpacity disabled={saving} onPress={() => void pickPhoto(index)} style={{ paddingVertical: 12 }}><Text style={{ color: colors.primary }}>{photoFor(index) ? 'Replace material photo' : 'Add material photo *'}</Text></TouchableOpacity>
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
      <SearchField title={inspection ? 'Pending Inspection' : 'Incoming deliveries'} icon="search-outline" value={search} onChangeText={setSearch} placeholder="Search job, PO, vendor, truck or material" />
      <Text style={{ color: colors.textMuted, marginTop: 12 }}>{queue.length} {inspection ? 'awaiting inspection' : 'awaiting receiving'}</Text>
      {!queue.length ? <Text style={{ color: colors.textMuted, paddingVertical: 24 }}>{inspection ? 'No materials pending inspection.' : 'No incoming deliveries.'}</Text> : queue.map(job => <TouchableOpacity key={job.id} style={card} onPress={() => { reset(); setMessage(''); setSelectedId(job.id); }}><Text style={{ color: colors.primary, fontWeight: '800' }}>{job.jobId || job.id}</Text><Text style={{ color: colors.text, marginTop: 8 }}>{receivingLines(job).map(line => line.materialName || line.productName).filter(Boolean).join(', ')}</Text><Text style={{ color: colors.textMuted, marginTop: 8 }}>{job.vendorName || '—'} · {job.plateNumber || '—'}</Text>{inspection ? <Text style={{ color: colors.textMuted, marginTop: 8 }}>Received: {receivingDate(job.storeReceiving?.receivedAt)}</Text> : null}</TouchableOpacity>)}
    </>}
  </ScrollView>;
}
