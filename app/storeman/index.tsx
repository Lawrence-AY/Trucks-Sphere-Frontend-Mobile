import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../hooks/useTheme';
import { useDeliveryOrders } from '@/store/realtimeData';
import { useRealTimeSyncStore } from '@/store/realTimeSyncStore';
import { acceptWarehouseDelivery, rejectWarehouseDelivery, updateDeliveryOrder } from '../../services/api';
import { uploadInspectionPhoto } from '../../services/uploadService';
import { isBulkMaterial, isWarehouseJob } from '../../utils/warehouse';
import { router, useLocalSearchParams } from 'expo-router';

const isIncoming = (job: any) => {
  if (job?.materialInspection?.materialReceipts?.length) return false;
  const warehouse = job?.isWarehouseDelivery || String(job?.deliveryOrigin || '').toLowerCase() === 'warehouse';
  const status = String(job?.status || '').toUpperCase();
  const materialText = [job?.materialType, job?.materialCategory, job?.category, job?.materialName, ...(job?.materials || []).map((item: any) => item?.materialType || item?.materialCategory || item?.category || item?.materialName)].filter(Boolean).join(' ').toLowerCase();
  const bulk = isBulkMaterial(job) || job?.isCountable === false || job?.countable === false || ['bulk', 'unbagged', 'murram', 'aggregate'].some((term) => materialText.includes(term));
  // Every delivery must complete site weigh-in/out first. Bulk goods go to
  // the inspector; all other measure types go to the storeman.
  if (bulk) return false;
  return job?.siteWeighInWeight != null && job?.siteWeighOutWeight != null && !job?.warehouseDeniedAt;
};
const formatEAT = (value: any) => value ? new Date(value).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const FAILURE_REASONS = ['Damaged', 'Spoiled', 'Contaminated', 'Wrong material or grade', 'Short quantity', 'Other'];
const warehouseMrf = (job: any) => {
  const lines = [...(job?.materials || []), ...(job?.additionalItems || []), ...(job?.items || [])];
  const line = lines.find((item: any) => String(item?.mrfNo || item?.mrfNumber || '').trim());
  return String(line?.mrfNo || line?.mrfNumber || '').trim() || 'Pending';
};

export default function StoremanReceivingScreen() {
  const colors = useTheme();
  const { jobId, id } = useLocalSearchParams<{ jobId?: string | string[]; id?: string | string[] }>();
  const jobs = useDeliveryOrders();
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent'>('all');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [quality, setQuality] = useState<Record<string, 'Pass' | 'Failed'>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [failureReasons, setFailureReasons] = useState<Record<string, string>>({});
  const [selectedJob, setSelectedJob] = useState<any>(null);
  useEffect(() => {
    const routeValue = jobId ?? id;
    const routeId = Array.isArray(routeValue) ? routeValue[0] : routeValue;
    if (routeId) {
      const job = jobs.find((item: any) => String(item.id) === String(routeId) || String(item.jobId) === String(routeId));
      if (job) setSelectedJob(job);
    }
  }, [jobId, id, jobs]);
  const incoming = useMemo(() => jobs.filter(isIncoming).map((job: any) => ({ ...job, driverName: undefined, plateNumber: undefined })), [jobs]);
  const visibleIncoming = useMemo(() => {
    const query = search.trim().toLowerCase();
    return incoming.filter((job: any) => {
      const matchesSearch = !query || [job.jobId, job.poNumber, warehouseMrf(job), job.materialName, job.vendorName]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const receipts = job.materialInspection?.materialReceipts || job.materialReceipts || [];
      const receiptDiscrepancy = receipts.some((line: any) => Number(line.receivedQuantity ?? 0) !== Number(line.orderedQuantity ?? line.quantity ?? 0));
      const hasDiscrepancy = receiptDiscrepancy || (Number(job.quantityOrdered || 0) > 0 && Number(job.quantityDelivered || 0) < Number(job.quantityOrdered || 0));
      return matchesSearch && (filter === 'all' || hasDiscrepancy);
    });
  }, [incoming, search, filter]);

  const inspect = async (job: any) => {
    const lines = (job.materials?.length ? job.materials : [{ materialId: job.materialId, materialName: job.materialName, quantity: job.quantityOrdered, unit: job.unit }]);
    const count = counts[job.id]?.trim() || counts[`${job.id}:${lines[0]?.materialId || 0}`]?.trim();
    if (!count || !Number.isFinite(Number(count)) || Number(count) < 0) return Alert.alert('Quantity required', 'Enter the physically received quantity.');
    if (!quality[job.id]) return Alert.alert('Inspection required', 'Pass or fail the material before saving.');
    if (quality[job.id] === 'Failed' && !reasons[job.id]?.trim()) return Alert.alert('Deficiency required', 'Describe the defect or deficiency.');
    const materialReceipts = lines.map((line: any, index: number) => { const lineCount = counts[`${job.id}:${line.materialId || index}`]?.trim() || count; return { materialId: line.materialId || '', materialName: line.materialName || line.productName || '', orderedQuantity: Number(line.quantity || 0), receivedQuantity: Number(lineCount), unit: line.unit || '', initialVisualInspection: quality[job.id], failureReason: quality[job.id] === 'Failed' ? reasons[job.id].trim() : '', deficiency: reasons[job.id]?.trim() || '', damagedQuantity: quality[job.id] === 'Failed' ? Number(lineCount) : 0 }; });
    try {
      // Warehouse inspections are only accepted by the API after the storeman
      // records the site's warehouse acceptance decision.
      let acceptedJob = job;
      if (isWarehouseJob(job) && !job.warehouseAcceptedAt) {
        const accepted = await acceptWarehouseDelivery(job.id);
        acceptedJob = { ...job, ...accepted, warehouseAcceptedAt: accepted?.warehouseAcceptedAt || new Date().toISOString() };
        useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', acceptedJob);
      }
      const saved = await updateDeliveryOrder(job.id, { materialInspection: { mrfNumber: acceptedJob.materialInspection?.mrfNumber || '', materialReceipts } });
      if (photos[job.id]) await uploadInspectionPhoto(job.id, photos[job.id]);
      await Promise.all(Object.entries(photos).filter(([key]) => key.startsWith(`${job.id}:`)).map(([key, photo]) => uploadInspectionPhoto(job.id, photo, key.split(':').slice(1).join(':'))));
      useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', { ...job, ...saved });
      setSelectedJob(null);
      Alert.alert('Inspection saved', `Receipt recorded for ${job.jobId || job.id}.`, [
        { text: 'Preview', onPress: () => router.push(`/screens/job-details?id=${encodeURIComponent(job.jobId || job.id)}` as any) },
        { text: 'View report', onPress: () => router.push('/store-account/history' as any) },
        { text: 'Done', style: 'cancel' },
      ]);
    } catch (error: any) { Alert.alert('Could not save inspection', error?.response?.data?.error || error?.message || 'Try again.'); }
  };

  const accept = async (job: any) => { try { const saved = await acceptWarehouseDelivery(job.id); useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', { ...job, ...saved }); } catch (error: any) { Alert.alert('Could not accept delivery', error?.response?.data?.error || 'Try again.'); } };
  const reject = async (job: any) => { const reason = reasons[job.id]?.trim(); if (!reason) return Alert.alert('Reason required', 'Explain why the materials are being rejected.'); try { const saved = await rejectWarehouseDelivery(job.id, reason); useRealTimeSyncStore.getState().optimisticUpdate('deliveryOrders', { ...job, ...saved }); } catch (error: any) { Alert.alert('Could not reject delivery', error?.response?.data?.error || 'Try again.'); } };

  const routeValue = jobId ?? id;
  const routeId = Array.isArray(routeValue) ? routeValue[0] : routeValue;
  if (routeId && !selectedJob) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text }}>Loading receiving details…</Text></View>;
  }
  if (selectedJob) {
    const detailLines = selectedJob.materials?.length ? selectedJob.materials : [{ materialId: selectedJob.materialId, materialName: selectedJob.materialName, quantity: selectedJob.quantityOrdered, unit: selectedJob.unit }];
    return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.page}>
      <TouchableOpacity onPress={() => setSelectedJob(null)}><Text style={{ color: colors.primary, fontWeight: '800', marginBottom: 12 }}>← Back to receiving</Text></TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>{selectedJob.jobId || selectedJob.id}</Text>
      <Text style={[styles.meta, { color: colors.text }]}>MRF: {warehouseMrf(selectedJob)} · PO: {selectedJob.poNumber || selectedJob.purchaseOrderId || '—'}</Text>
      <Text style={[styles.meta, { color: colors.text }]}>Warehouse dispatch materials</Text>
      {selectedJob.packagingPhotoURL || selectedJob.deliveryNoteURL || selectedJob.photoURL ? <Image source={{ uri: selectedJob.packagingPhotoURL || selectedJob.deliveryNoteURL || selectedJob.photoURL }} style={{ width: '100%', height: 180, borderRadius: 10, marginVertical: 10 }} /> : null}
      {detailLines.map((line: any, index: number) => { const key = `${selectedJob.id}:${line.materialId || index}`; return <View key={key} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.job, { color: colors.text }]}>{line.materialName || 'Material'}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Dispatched: {line.quantity ?? selectedJob.quantityOrdered ?? '—'} {line.unit || selectedJob.unit || ''}</Text><TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Received quantity" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={counts[key] || ''} onChangeText={(value) => setCounts((x) => ({ ...x, [key]: value }))} /><View style={styles.actions}><TouchableOpacity style={styles.accept} onPress={() => setQuality((x) => ({ ...x, [selectedJob.id]: 'Pass' }))}><Text style={styles.buttonText}>Accept</Text></TouchableOpacity><TouchableOpacity style={styles.reject} onPress={() => setQuality((x) => ({ ...x, [selectedJob.id]: 'Failed' }))}><Text style={styles.buttonText}>Reject</Text></TouchableOpacity><TouchableOpacity style={styles.filterButton} onPress={async () => { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) return; const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .75 }); if (!result.canceled && result.assets?.[0]?.uri) setPhotos((x) => ({ ...x, [key]: result.assets[0].uri })); }}><Text style={{ color: colors.text }}>Photo</Text></TouchableOpacity></View>{photos[key] ? <Image source={{ uri: photos[key] }} style={{ width: '100%', height: 130, marginTop: 8, borderRadius: 8 }} /> : null}</View>; })}
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Failure/deficiency details" placeholderTextColor={colors.textMuted} value={reasons[selectedJob.id] || ''} onChangeText={(value) => setReasons((x) => ({ ...x, [selectedJob.id]: value }))} /><TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} onPress={() => { void inspect(selectedJob); }}><Text style={styles.buttonText}>Complete receiving and inspection</Text></TouchableOpacity>
    </ScrollView>;
  }

  // Initial view intentionally contains only warehouse job cards. All actions
  // are available after a card is opened.
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh('deliveryOrders'); setRefreshing(false); }} />}>
   <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="Search job, PO, MRF or material" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
    {!visibleIncoming.length ? <Text style={{ color: colors.textMuted, marginTop: 24 }}>No incoming warehouse deliveries.</Text> : visibleIncoming.map((job: any) => <TouchableOpacity key={job.id} onPress={() => router.push({ pathname: '/store-account/[id]', params: { id: String(job.id) } } as any)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.job, { color: colors.primary }]}>{job.jobId || job.id}</Text><Text style={[styles.meta, { color: colors.text }]}>MRF: {warehouseMrf(job)} · PO: {job.poNumber || job.purchaseOrderId || '—'}</Text><Text style={[styles.meta, { color: colors.text }]}>Materials: {(job.materials?.length ? job.materials : [{ materialName: job.materialName }]).map((line: any) => line.materialName).filter(Boolean).join(', ') || '—'}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Quantity: {job.quantityOrdered ?? '—'} {job.unit || ''}</Text></TouchableOpacity>)}
  </ScrollView>;

  /* Legacy inline view retained below for reference; the card-only view above is active. */ return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh('deliveryOrders'); setRefreshing(false); }} />}>
    <Text style={[styles.title, { color: colors.text }]}>Store Receiving</Text>
     <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="Search job, PO, MRF, material or vendor" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
    <View style={styles.filters}><TouchableOpacity style={[styles.filterButton, { borderColor: colors.border }, filter === 'all' && { backgroundColor: colors.primary }]} onPress={() => setFilter('all')}><Text style={{ color: filter === 'all' ? '#fff' : colors.text }}>All shipments</Text></TouchableOpacity><TouchableOpacity style={[styles.filterButton, { borderColor: colors.border }, filter === 'urgent' && { backgroundColor: '#DC2626' }]} onPress={() => setFilter('urgent')}><Text style={{ color: filter === 'urgent' ? '#fff' : colors.text }}>Discrepancies</Text></TouchableOpacity></View>
    {!visibleIncoming.length ? <Text style={{ color: colors.textMuted, marginTop: 24 }}>No incoming deliveries match the selected filters.</Text> : visibleIncoming.map((job: any) => <View key={job.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> <TouchableOpacity onPress={() => setSelectedJob(job)}><Text style={[styles.job, { color: colors.primary }]}>{job.jobId || job.id}</Text><Text style={{ color: colors.textMuted }}>Open item-by-item receiving</Text></TouchableOpacity>
      <Text style={[styles.job, { color: colors.primary }]}>{job.jobId || job.id}</Text><Text style={[styles.meta, { color: colors.text }]}>PO: {job.poNumber || job.purchaseOrderId || '—'} · MRF: {job.materialInspection?.mrfNumber || job.mrfNumber || 'Pending'}</Text><Text style={[styles.meta, { color: colors.text }]}>Material: {job.materialName || job.materials?.map((x: any) => x.materialName).join(', ') || '—'} · Ordered: {job.quantityOrdered ?? '—'} {job.unit || ''}</Text>{!isWarehouseJob(job) ? <><Text style={[styles.meta, { color: colors.textMuted }]}>Vendor: {job.vendorName || '—'} · Driver: {job.driverName || '—'} · Truck: {job.plateNumber || '—'}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Weigh-in: {job.siteWeighInAt || job.weighInAt || job.updatedAt || '—'}</Text></> : null}{job.siteWeighOutWeight != null || job.siteNetWeight != null || job.netWeight != null ? <Text style={[styles.meta, { color: colors.textMuted }]}>Net dispatched: {job.netWeight ?? job.weighOutWeight ?? '—'} · Net received: {job.siteNetWeight ?? job.quantityDelivered ?? 'Pending store count'}</Text> : null}
      <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Quantity received" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={counts[job.id] || ''} onChangeText={(value) => setCounts((x) => ({ ...x, [job.id]: value }))} /><View style={styles.actions}><TouchableOpacity style={styles.accept} onPress={() => setQuality((x) => ({ ...x, [job.id]: 'Pass' }))}><Text style={styles.buttonText}>Pass</Text></TouchableOpacity><TouchableOpacity style={styles.reject} onPress={() => setQuality((x) => ({ ...x, [job.id]: 'Failed' }))}><Text style={styles.buttonText}>Fail</Text></TouchableOpacity></View><TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Deficiency / spoilage details" placeholderTextColor={colors.textMuted} value={reasons[job.id] || ''} onChangeText={(value) => setReasons((x) => ({ ...x, [job.id]: value }))} /><TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} onPress={() => { void inspect(job); }}><Text style={styles.buttonText}>Save inspection</Text></TouchableOpacity><TouchableOpacity style={[styles.primary, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={async () => { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) return Alert.alert('Camera permission required'); const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 }); if (!result.canceled && result.assets?.[0]?.uri) setPhotos((x) => ({ ...x, [job.id]: result.assets[0].uri })); }}><Text style={{ color: colors.text }}>{photos[job.id] ? 'Retake material photo' : 'Capture material photo'}</Text></TouchableOpacity>{photos[job.id] ? <Image source={{ uri: photos[job.id] }} style={{ width: '100%', height: 150, marginTop: 8, borderRadius: 8 }} /> : null}<View style={styles.actions}><TouchableOpacity style={styles.accept} onPress={() => accept(job)}><Text style={styles.buttonText}>Accept</Text></TouchableOpacity><TouchableOpacity style={styles.reject} onPress={() => reject(job)}><Text style={styles.buttonText}>Reject</Text></TouchableOpacity></View>
    </View>)}
    <Modal visible={Boolean(selectedJob)} transparent animationType="slide" onRequestClose={() => setSelectedJob(null)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.4)' }}><View style={[styles.card, { backgroundColor: colors.surface, maxHeight: '85%' }]}><Text style={[styles.title, { color: colors.text }]}>Receive {selectedJob?.jobId || ''}</Text>{(selectedJob?.materials?.length ? selectedJob.materials : [{ materialId: selectedJob?.materialId, materialName: selectedJob?.materialName, quantity: selectedJob?.quantityOrdered, unit: selectedJob?.unit }]).map((line: any, index: number) => { const key = `${selectedJob?.id}:${line.materialId || index}`; return <View key={key} style={{ marginTop: 10 }}><Text style={[styles.meta, { color: colors.text, fontWeight: '800' }]}>{line.materialName || 'Material'}</Text><TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Quantity received" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={counts[key] || ''} onChangeText={(value) => setCounts((x) => ({ ...x, [key]: value }))} /><View style={styles.actions}><TouchableOpacity style={styles.accept} onPress={() => setQuality((x) => ({ ...x, [selectedJob.id]: 'Pass' }))}><Text style={styles.buttonText}>Pass</Text></TouchableOpacity><TouchableOpacity style={styles.reject} onPress={() => setQuality((x) => ({ ...x, [selectedJob.id]: 'Failed' }))}><Text style={styles.buttonText}>Fail</Text></TouchableOpacity><TouchableOpacity style={styles.filterButton} onPress={async () => { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) return; const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .75 }); if (!result.canceled && result.assets?.[0]?.uri) setPhotos((x) => ({ ...x, [key]: result.assets[0].uri })); }}><Text style={{ color: colors.text }}>Photo</Text></TouchableOpacity></View>{photos[key] ? <Image source={{ uri: photos[key] }} style={{ width: '100%', height: 100, marginTop: 6, borderRadius: 8 }} /> : null}</View>})}<TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} onPress={() => { if (selectedJob) void inspect(selectedJob); }}><Text style={styles.buttonText}>Complete receiving</Text></TouchableOpacity><TouchableOpacity onPress={() => setSelectedJob(null)} style={{ padding: 12, alignItems: 'center' }}><Text style={{ color: colors.textMuted }}>Cancel</Text></TouchableOpacity></View></View></Modal>
    <Text style={[styles.title, { color: colors.text, marginTop: 24 }]}>Storeman activity report</Text>
    {jobs.filter((job: any) => job.materialInspection?.materialReceipts?.length).map((job: any) => <View key={`report-${job.id}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.job, { color: colors.primary }]}>{job.jobId || job.id} · {job.poNumber || job.purchaseOrderId || 'No PO'}</Text><Text style={[styles.meta, { color: colors.textMuted }]}>Inspector: {job.materialInspection?.inspectorName || job.warehouseAcceptedByName || 'Storeman'} · {formatEAT(job.materialInspection?.inspectedAt || job.updatedAt)}</Text>{job.materialInspection.materialReceipts.map((line: any, index: number) => <Text key={index} style={[styles.meta, { color: colors.text }]}> {line.materialName}: {line.receivedQuantity} {line.unit || ''} · {line.initialVisualInspection || 'Pending'}{line.failureReason || line.deficiency ? ` · ${line.failureReason || line.deficiency}` : ''}</Text>)}</View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { padding: 20, paddingBottom: 48 }, title: { fontSize: 25, fontWeight: '800' }, subtitle: { marginTop: 6, marginBottom: 18 }, card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 }, job: { fontSize: 17, fontWeight: '800', marginBottom: 8 }, meta: { fontSize: 13, marginBottom: 6 }, input: { borderWidth: 1, borderRadius: 8, padding: 11, marginTop: 10 }, filters: { flexDirection: 'row', gap: 8, marginVertical: 10 }, filterButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 }, primary: { borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 }, actions: { flexDirection: 'row', gap: 10, marginTop: 10 }, accept: { flex: 1, backgroundColor: '#059669', borderRadius: 8, padding: 12, alignItems: 'center' }, reject: { flex: 1, backgroundColor: '#DC2626', borderRadius: 8, padding: 12, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '800' } });
