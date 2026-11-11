import { useRef, useState } from 'react';
import { Image, Platform, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useRealtimeCollection } from '../store/realtimeData';
import { useRealTimeSyncStore } from '../store/realTimeSyncStore';
import { receiveStoreDelivery, inspectStoreDelivery } from '../services/api';
import { uploadReceivingPhoto } from '../services/uploadService';
import { isStoreIncoming, isStorePendingInspection, receivingLines, receivingDate } from '../utils/storeReceiving';
import { STOREMAN_GENERAL_METRICS, storemanInspectionReady } from '../utils/storemanInspection';
import { InspectionChoice } from './InspectionChoice';
import { SearchField } from './EnterpriseUI';
import { StoreReceiptDetails } from './StoreReceiptDetails';
import { CommandHeader, PageShell } from './EnterpriseUI';

export default function StoreReceivingWorkflow({ inspection = false }: { inspection?: boolean }) {
  const colors = useTheme();
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const refresh = useRealTimeSyncStore(state => state.refresh);
  const eligible = inspection ? isStorePendingInspection : isStoreIncoming;
  const selected = jobs.find(job => job.id === selectedId || job.jobId === selectedId);
  const lines = selected ? receivingLines(selected) : [];
  const queue = jobs.filter(eligible).filter(job => !search.trim() || [job.jobId, job.poNumber, job.vendorName, job.driverName, job.plateNumber, ...receivingLines(job).map(line => line.materialName)].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));
  const reset = () => { setSelectedId(null); setQuantities({}); setPhotos({}); uploaded.current = {}; setDecision(undefined); setReason(''); setDeliveredBy(''); setChecks({}); setAccepted({}); setRejected({}); setFailureReasons({}); requestId.current = ''; setError(''); };
  const photoFor = (index: number) => photos[index] || selected?.receivingEvidence?.find((photo: any) => photo.lineIndex === index)?.url;
  const decisionReady = inspection ? storemanInspectionReady(decision, checks, reason) : decision === 'Pass' || (decision === 'Failed' && Boolean(reason.trim()));
  const hasSplit = inspection && Object.keys({ ...accepted, ...rejected, ...failureReasons }).length > 0;
  const ready = Boolean(selected && eligible(selected) && decisionReady && (inspection
    ? (!hasSplit || lines.every((line, index) => { const total = Number(line.receivedQuantity) || 0; const yes = Number(accepted[index]); const no = Number(rejected[index]); return Number.isFinite(yes) && Number.isFinite(no) && yes >= 0 && no >= 0 && Math.abs(yes + no - total) < 1e-6 && (no === 0 || Boolean(failureReasons[index]?.trim())); }))
    : (Boolean(deliveredBy.trim() || selected.driverName) && lines.every((_, index) => quantities[index]?.trim() && Number.isFinite(Number(quantities[index])) && Number(quantities[index]) >= 0 && photoFor(index)))));
  const pickPhoto = async (index: number, source: 'camera' | 'library' = 'camera') => {
    try {
      const permission = Platform.OS === 'web' ? { granted: true } : await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { setError('Camera permission is needed to capture the material photo.'); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: .75 };
      const result = Platform.OS === 'web' || source === 'library' ? await ImagePicker.launchImageLibraryAsync(options) : await ImagePicker.launchCameraAsync(options);
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
        ? await inspectStoreDelivery(selected.id, { requestId: requestId.current, result: decision, qualityChecks: checks, reason, ...(hasSplit ? { lineDecisions: lines.map((line, index) => ({ acceptedQuantity: Number(accepted[index]), rejectedQuantity: Number(rejected[index]), failureReason: failureReasons[index] || '' })) } : {}) })
        : await receiveStoreDelivery(selected.id, { requestId: requestId.current, quantities: lines.map((_, index) => quantities[index]), condition: decision, reason, deliveredByName: deliveredBy.trim() || selected.driverName || '' });
      useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', saved);
      if (saved.receivingStatus === 'inventory_added') void refresh('purchaseOrders').catch(() => {});
      setMessage(decision === 'Failed' ? 'Delivery rejected and flagged. No inventory added.' : inspection ? 'Inspection passed. Materials added to inventory.' : 'Receiving saved. This delivery is now Pending Inspection.');
      reset();
    } catch (err: any) { setError(err?.response?.data?.error || err.message || 'Could not save. Your entries have been kept for retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const card = { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16 };
  const input = { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 };
  return <PageShell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await refresh('deliveryOrders'); } finally { setRefreshing(false); } }} />}>
    <CommandHeader title={inspection ? 'Quality inspection' : 'Store receiving'} subtitle={inspection ? 'Review received materials and photo evidence before approving inventory.' : 'Count materials, record their condition, and capture a photo for each material.'} />
    {message ? <Text accessibilityRole="alert" style={{ color: colors.success, marginVertical: 10 }}>{message}</Text> : null}
    {deliveryError ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginVertical: 10 }}>Could not load deliveries: {deliveryError}. Please sign in again or contact an administrator.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginVertical: 10 }}>{error}</Text> : null}
    {selectedId ? <>
      <TouchableOpacity disabled={saving} onPress={reset}><Text style={{ color: colors.primary, paddingVertical: 12 }}>← Back to {inspection ? 'inspection queue' : 'receiving'}</Text></TouchableOpacity>
      {!selected ? <Text style={{ color: colors.textMuted }}>Loading delivery details. Pull to refresh if needed.</Text> : !eligible(selected) ? <View style={card}><Text style={{ color: colors.text }}>This delivery has already moved out of this queue.</Text>{selected.storeReceiving ? <StoreReceiptDetails job={selected} /> : null}</View> : <>
        <View style={card}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 19 }}>{selected.jobId || selected.id}</Text><Text style={{ color: colors.textMuted, marginTop: 8 }}>PO: {selected.poNumber || selected.purchaseOrderId || '—'} · Vendor: {selected.vendorName || '—'}</Text><Text style={{ color: colors.textMuted, marginTop: 8 }}>Driver: {selected.driverName || '—'} · Truck: {selected.plateNumber || '—'}</Text></View>
        {inspection ? <View style={card}><StoreReceiptDetails job={selected} />
          {lines.map((line, index) => <View key={`split-${index}`} style={{ marginTop: 16, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || 'Material'} — Received: {line.receivedQuantity} {line.unit || ''}</Text>
            <TextInput editable={!saving} keyboardType="decimal-pad" placeholder={`Accepted ${line.unit || 'quantity'}`} placeholderTextColor={colors.textMuted} value={accepted[index] ?? String(line.receivedQuantity ?? '')} onChangeText={value => { setAccepted(current => ({ ...current, [index]: value })); if (rejected[index] == null) setRejected(current => ({ ...current, [index]: '0' })); }} style={input} />
            <TextInput editable={!saving} keyboardType="decimal-pad" placeholder={`Rejected ${line.unit || 'quantity'}`} placeholderTextColor={colors.textMuted} value={rejected[index] ?? '0'} onChangeText={value => { setRejected(current => ({ ...current, [index]: value })); if (accepted[index] == null) setAccepted(current => ({ ...current, [index]: String(Math.max(0, (Number(line.receivedQuantity) || 0) - (Number(value) || 0))) })); }} style={input} />
            {Number(rejected[index] ?? 0) > 0 ? <TextInput editable={!saving} multiline placeholder="Failure reason for rejected quantity *" placeholderTextColor={colors.textMuted} value={failureReasons[index] || ''} onChangeText={value => setFailureReasons(current => ({ ...current, [index]: value }))} style={input} /> : null}
          </View>)}
        </View> : <>
          {lines.map((line, index) => <View key={index} style={card}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || line.productName || 'Material'}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>Dispatched: {line.quantity ?? '—'} {line.unit || ''}</Text>
            <TextInput accessibilityLabel={`Received quantity for ${line.materialName || 'material'}`} editable={!saving} inputAccessoryViewID="trucksphere-keyboard-done" placeholder="Received quantity *" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={quantities[index] || ''} onChangeText={value => setQuantities(current => ({ ...current, [index]: value }))} style={input} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <TouchableOpacity disabled={saving} onPress={() => void pickPhoto(index, 'camera')} style={{ paddingVertical: 12 }}><Text style={{ color: colors.primary }}>{photoFor(index) ? 'Replace material photo' : 'Capture material photo *'}</Text></TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={() => void pickPhoto(index, 'library')} style={{ paddingVertical: 12 }}><Text style={{ color: colors.primary }}>Upload from device</Text></TouchableOpacity>
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
      <SearchField title={inspection ? 'Pending Inspection' : 'Incoming deliveries'} icon="search-outline" value={search} onChangeText={setSearch} placeholder="Search job, PO, vendor, truck or material" />
      <Text style={{ color: colors.textMuted, marginTop: 12 }}>{queue.length} {inspection ? 'awaiting inspection' : 'awaiting receiving'}</Text>
      {!queue.length ? <Text style={{ color: colors.textMuted, paddingVertical: 24 }}>{inspection ? 'No materials pending inspection.' : 'No incoming deliveries.'}</Text> : <View style={{ gap: 6 }}>{queue.map(job => <TouchableOpacity key={job.id} style={card} onPress={() => { reset(); setMessage(''); setSelectedId(job.id); }}><Text style={{ color: colors.primary, fontWeight: '800' }}>{job.jobId || job.id}</Text><Text style={{ color: colors.text, marginTop: 8 }}>{receivingLines(job).map(line => line.materialName || line.productName).filter(Boolean).join(', ')}</Text><Text style={{ color: colors.textMuted, marginTop: 8 }}>{job.vendorName || '—'} · {job.plateNumber || '—'}</Text>{inspection ? <Text style={{ color: colors.textMuted, marginTop: 8 }}>Received: {receivingDate(job.storeReceiving?.receivedAt)}</Text> : null}</TouchableOpacity>)}</View>}
    </>}
  </PageShell>;
}
