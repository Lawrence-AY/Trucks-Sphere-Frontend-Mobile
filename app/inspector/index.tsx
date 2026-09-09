import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDeliveryOrders, fetchPurchaseOrders, updateDeliveryOrder } from '../../services/api';
import { uploadInspectionPhoto } from '../../services/uploadService';
import { useAuthStore } from '../../store/authStore';
import { getInspectorSelection, setInspectorSelection } from '../../utils/inspectorSelection';
import { buildHtmlContent, sharePdfAsFile } from '../../utils/exportData';
import { useDeliveryOrders } from '../../store/realtimeData';
import { isWarehouseJob } from '../../utils/warehouse';
import { isAwaitingInspection } from '../../utils/inspection';

const materialLines = (job: any, purchaseOrders: any[] = []) => {
  if (job?.isWarehouseDelivery && !job.materials?.length) return [{ materialId: job.materialId, materialName: job.materialName, quantity: job.quantityOrdered, unit: job.unit }, ...(job.additionalItems || []).map((line: any, index: number) => ({ ...line, materialId: line.materialId || `warehouse-${index}` }))];
  const jobLines = Array.isArray(job?.materials) && job.materials.length ? job.materials : [];
  if (jobLines.length) return jobLines;
  const po = purchaseOrders.find((order) => String(order.id) === String(job?.purchaseOrderId));
  if (Array.isArray(po?.materials) && po.materials.length) return po.materials;
  return [{ materialId: job?.materialId, materialName: job?.materialName, quantity: job?.quantityOrdered, unit: job?.unit }];
};

const materialList = (job: any, purchaseOrders: any[] = []) => materialLines(job, purchaseOrders)
  .map((item: any) => `${item.materialName || 'Material'}${item.quantity != null ? ` — ${item.quantity} ${item.unit || ''}` : ''}`).join('\n');

export default function InspectorScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const realtimeDeliveries = useDeliveryOrders();
  const { jobId, id } = useLocalSearchParams<{ jobId?: string; id?: string }>();
  const [jobs, setJobs] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [materialChecks, setMaterialChecks] = useState<Record<string, { result: '' | 'Pass' | 'Failed'; reason: string; deficiency: string }>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [confirmation, setConfirmation] = useState<{ mrfNumber: string; materialCount: number; jobId: string; poNumber: string; materialReceipts: any[]; inspectorName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const requestedId = id || jobId;
    // Render the selected card immediately; the API refresh below only
    // reconciles it in the background.
    if (!requestedId) setActive(null);
    const selected = requestedId ? getInspectorSelection(requestedId) : null;
    if (selected) setActive(selected);
    const [data, orders] = await Promise.all([fetchDeliveryOrders(), fetchPurchaseOrders()]);
    setPurchaseOrders(orders || []);
    const pending = data.filter(isAwaitingInspection);
    setJobs(pending);
    if (requestedId) setActive(pending.find((job: any) => job.jobId === requestedId || job.id === requestedId) || null);
  }, [id, jobId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const pending = realtimeDeliveries.filter(isAwaitingInspection);
    setJobs(pending);
    const requestedId = id || jobId;
    if (requestedId) setActive((current: any) => pending.find((job: any) => job.jobId === requestedId || job.id === requestedId) || current);
  }, [realtimeDeliveries, id, jobId]);

  const form = useMemo(() => active?.materialInspection || {}, [active]);
  const activeMaterialLines = useMemo(() => materialLines(active, purchaseOrders), [active, purchaseOrders]);
  useEffect(() => {
    if (!active) return;
    const lines = activeMaterialLines;
    // New inspections intentionally start blank; historical records retain
    // their captured values when opened for reference.
    setReceivedQuantities(Object.fromEntries(lines.map((line: any, index: number) => [String(line.materialId || index), form.mrfNumber ? String(form.materialReceipts?.find((receipt: any) => String(receipt.materialId || '') === String(line.materialId || ''))?.receivedQuantity ?? '') : ''])));
    setMaterialChecks(Object.fromEntries(lines.map((line: any, index: number) => {
      const receipt = form.materialReceipts?.find((item: any) => String(item.materialId || '') === String(line.materialId || '')) || {};
      const key = String(line.materialId || index);
      return [key, { result: receipt.initialVisualInspection === 'Pass' || receipt.initialVisualInspection === 'Failed' ? receipt.initialVisualInspection : '', reason: receipt.failureReason || '', deficiency: receipt.deficiency || '' }];
    })));
  }, [active, activeMaterialLines, form]);

  const capturePhoto = async (materialKey: string) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera permission', 'Camera access is required to capture inspection evidence.');
    const captured = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (!captured.canceled && captured.assets?.[0]) setPhotos((current) => ({ ...current, [materialKey]: captured.assets[0].uri }));
  };
  const save = async () => {
    if (!active || active.id === savedJobId) return;
    const lines = activeMaterialLines;
    const incompleteEvidence = lines.find((line: any, index: number) => {
      const key = String(line.materialId || index);
      // Treat zero as a captured quantity; only a blank field means no quantity.
      const hasQuantity = String(receivedQuantities[key] || '').trim().length > 0;
      const hasPhoto = Boolean(photos[key]);
      return hasQuantity !== hasPhoto;
    });
    if (incompleteEvidence) return Alert.alert(
      'Photo and quantity required together',
      `${incompleteEvidence.materialName || 'This material'} needs both a captured photo and a received quantity (including 0), or neither.`,
    );
    const materialReceipts = lines.map((line: any, index: number) => { const key = String(line.materialId || index); const check = materialChecks[key] || { result: '', reason: '', deficiency: '' }; return { materialId: line.materialId || String(index), materialName: line.materialName || 'Material', unit: line.unit || active.unit || '', orderedQuantity: Number(line.quantity || 0), receivedQuantity: Number(receivedQuantities[key] || 0), initialVisualInspection: check.result || 'Pending', failureReason: check.result === 'Failed' ? check.reason.trim() : '', deficiency: check.deficiency.trim() }; });
    if (materialReceipts.some((line: any) => line.initialVisualInspection === 'Failed' && !line.failureReason)) return Alert.alert('Reason required', 'Enter a failure reason for every material marked Failed.');
    if (materialReceipts.some((line: any) => !Number.isFinite(line.receivedQuantity) || line.receivedQuantity < 0)) return Alert.alert('Invalid quantity', 'Enter a valid received quantity for every material.');
    if (active.isWarehouseDelivery && lines.some((line: any, index: number) => !String(receivedQuantities[String(line.materialId || index)] ?? '').trim())) return Alert.alert('Quantity required', 'Enter the actual received quantity for every warehouse product, including zero for missing items.');
    if (active.isWarehouseDelivery && materialReceipts.some((line: any) => !['Pass', 'Failed'].includes(line.initialVisualInspection))) return Alert.alert('Inspection required', 'Choose Pass or Failed for every warehouse product.');
    setSaving(true);
    try {
      const inspection = await updateDeliveryOrder(active.id, { materialInspection: {
        // Summary stays compatible with existing reports; the authoritative
        // Pass/Failed decision is recorded on each material receipt below.
        initialVisualInspection: materialReceipts.some((line: any) => line.initialVisualInspection === 'Failed') ? 'Failed' : materialReceipts.every((line: any) => line.initialVisualInspection === 'Pass') ? 'Pass' : 'Pending',
        failureReason: '', deficiency: '',
        inspectorUid: user?.uid || '', inspectorName: user?.displayName || user?.email || 'Inspector', inspectedAt: new Date().toISOString(),
        materialReceipts,
      }});
      await Promise.all(Object.entries(photos).map(([materialId, photo]) => uploadInspectionPhoto(active.id, photo, materialId)));
      setSavedJobId(active.id);
      setConfirmation({ mrfNumber: inspection.materialInspection?.mrfNumber || 'MIF', materialCount: materialReceipts.length, jobId: active.jobId || active.id, poNumber: active.poNumber || '', materialReceipts, inspectorName: user?.displayName || user?.email || 'Inspector' });
      // Keep the completion dialog mounted until the Inspector explicitly
      // chooses an action. Refreshing here clears the active job and causes
      // the modal to disappear before it can be confirmed.
      setPhotos({});
    } catch (error: any) { Alert.alert('Could not save inspection', error?.message || 'Please try again.'); }
    finally { setSaving(false); }
  };
  const printInspectionPdf = async () => {
    if (!confirmation) return;
    setPrinting(true);
    try {
      const headers = ['MIF #', 'Job ID', 'PO #', 'Material', 'PO Qty', 'Received Qty', 'Unit', 'Result', 'Failure reason', 'Deficiency', 'Inspector'];
      const rows = confirmation.materialReceipts.map((line: any) => [confirmation.mrfNumber, confirmation.jobId, confirmation.poNumber, line.materialName || '', String(line.orderedQuantity ?? ''), String(line.receivedQuantity ?? ''), line.unit || '', line.initialVisualInspection || 'Pending', line.failureReason || '', line.deficiency || '', confirmation.inspectorName]);
      await sharePdfAsFile(`Material Inspection Form - ${confirmation.mrfNumber}`, buildHtmlContent(headers, rows, 'Material Inspection Form'));
    } catch (error: any) { Alert.alert('Print error', error?.message || 'Could not create the PDF.'); }
    finally { setPrinting(false); }
  };

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  if (!active) return <ScrollView style={[styles.page, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={colors.accent} />}>
     {jobs.map((job) => <TouchableOpacity key={job.id} disabled={openingJobId === job.id} onPress={() => { if (openingJobId) return; setOpeningJobId(job.id); setInspectorSelection(job); router.push(`/inspector/inspect/${encodeURIComponent(job.id)}` as any); setTimeout(() => setOpeningJobId(null), 1000); }} 
     style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, openingJobId === job.id && { opacity: .65 }]}>
      <Text style={[styles.jobId, { color: colors.text }]}>{job.jobId}</Text>
      <Text style={{ color: colors.textMuted }}>{isWarehouseJob(job) ? 'Warehouse delivery' : `${job.driverName || 'Unassigned'} · ${job.plateNumber || 'N/A'}`}</Text>
      <Text style={[styles.materials, { color: colors.text }]}>{materialList(job, purchaseOrders)}</Text>
      <Text style={{ color: job.materialInspection?.mrfNumber ? '#059669' : '#B45309', fontWeight: '700' }}>{job.materialInspection?.mrfNumber ? `${job.materialInspection.mrfNumber} — completed` : 'Inspection pending'}</Text>
    </TouchableOpacity>)}
    {!jobs.length && <Text style={{ color: colors.textMuted }}>No arrivals are awaiting inspection.</Text>}
  </ScrollView>;

  return <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">

    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.jobId, { color: colors.text }]}>{active.jobId}</Text>
      <Text style={[styles.materials, { color: colors.text }]}>{materialList(active, purchaseOrders)}</Text></View>
    <Text style={[styles.label, { color: colors.text }]}>Material inspections</Text>
    <View style={styles.materialList}>{activeMaterialLines.map((line: any, index: number) => { const key = String(line.materialId || index); return <View key={key} style={[styles.materialInput, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || 'Material'}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Initial visual inspection</Text>
      <View style={styles.choiceRow}>{(['Pass','Failed'] as const).map((value) => <TouchableOpacity key={value} onPress={() => setMaterialChecks((current) => ({ ...current, [key]: { ...(current[key] || { reason: '', deficiency: '' }), result: value } }))} style={[styles.choice, { borderColor: materialChecks[key]?.result === value ? (value === 'Pass' ? '#10B981' : '#EF4444') : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: materialChecks[key]?.result === value ? (value === 'Pass' ? '#10B981' : '#EF4444') : colors.text }}>{value}</Text></TouchableOpacity>)}</View>
      {materialChecks[key]?.result === 'Failed' ? <><Text style={{ color: colors.textMuted, fontSize: 12 }}>Failure reason *</Text><TextInput value={materialChecks[key]?.reason || ''} onChangeText={(value) => setMaterialChecks((current) => ({ ...current, [key]: { ...(current[key] || { result: 'Failed', deficiency: '' }), reason: value } }))} multiline style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="Describe why this material failed" placeholderTextColor={colors.textMuted}/></> : null}
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Deficiency (if any)</Text><TextInput value={materialChecks[key]?.deficiency || ''} onChangeText={(value) => setMaterialChecks((current) => ({ ...current, [key]: { ...(current[key] || { result: '', reason: '' }), deficiency: value } }))} multiline style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="Material-specific deficiency" placeholderTextColor={colors.textMuted}/>
    
      <View style={styles.captureRow}><TouchableOpacity onPress={() => { void capturePhoto(key); }} style={[styles.materialPhoto, { borderColor: colors.border }]}>{photos[key] ? <Image source={{ uri: photos[key] }} style={styles.materialPreview}/> : <><Ionicons name="camera-outline" size={17} color={colors.textMuted}/><Text style={{ color: colors.textMuted, fontSize: 12 }}>Capture photo</Text></>}</TouchableOpacity><View style={{ flex: 1 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Received quantity</Text><TextInput keyboardType="decimal-pad" value={receivedQuantities[key] || ''} onChangeText={(value) => setReceivedQuantities((current) => ({ ...current, [key]: value }))} 
      style={[styles.qtyInput, { color: colors.text, borderColor: colors.border }]} placeholder="Enter qty" placeholderTextColor={colors.textMuted}/></View></View></View>; })}</View>
    {active?.isWarehouseDelivery && activeMaterialLines.some((line: any, index: number) => Number(receivedQuantities[String(line.materialId || index)] || 0) > Number(line.quantity || 0)) ? <Text style={{ color: colors.danger }}>Received quantity exceeds the warehouse dispatch. This discrepancy will be flagged in management reports.</Text> : null}
    <TouchableOpacity onPress={save} disabled={saving || active.id === savedJobId} style={[styles.save, { opacity: saving || active.id === savedJobId ? .6 : 1 }]}><Text style={styles.saveText}>{saving ? 'Saving…' : active.id === savedJobId ? 'Inspection saved' : 'Save MIF inspection'}</Text></TouchableOpacity>
  <Modal visible={Boolean(confirmation)} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}>
    <View style={styles.confirmBackdrop}><View style={[styles.confirmCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
      <View style={styles.confirmIcon}><Ionicons name="checkmark" size={34} color="#fff"/></View>
      <Text style={[styles.confirmTitle,{color:colors.text}]}>Inspection saved</Text><Text style={{color:colors.textMuted,textAlign:'center'}}>{confirmation?.mrfNumber} has been created with {confirmation?.materialCount} material record{confirmation?.materialCount===1?'':'s'}.</Text><TouchableOpacity onPress={() => { void printInspectionPdf(); }} disabled={printing} style={[styles.confirmButton,styles.printButton,{opacity:printing ? .6 : 1}]}><Ionicons name="print-outline" size={18} color="#fff"/><Text style={styles.saveText}>{printing?'Preparing PDF…':'Print PDF'}</Text></TouchableOpacity><TouchableOpacity onPress={() => { setConfirmation(null); router.replace('/inspector/history' as any); }} style={styles.confirmButton}><Text style={styles.saveText}>View history</Text></TouchableOpacity><TouchableOpacity onPress={() => { setConfirmation(null); setActive(null); router.replace('/inspector' as any); }} style={styles.confirmButton}><Text style={styles.saveText}>Go back</Text></TouchableOpacity><TouchableOpacity onPress={() => setConfirmation(null)} style={styles.confirmButton}><Text style={styles.saveText}>Stay here</Text></TouchableOpacity></View></View></Modal>
  </ScrollView></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ page:{flex:1}, content:{padding: Spacing.md,paddingTop:0,
  gap:Spacing.md}, titleRow:{gap:4,marginBottom:Spacing.sm}, 
  title:{fontSize:22,fontWeight:'800'}, 
  subtitle:{fontSize:14}, card:{borderWidth:1,borderRadius:Radius.lg,padding:Spacing.md,gap:8},
   jobId:{fontSize:16,fontWeight:'800'}, materials:{fontSize:14,lineHeight:21}, 
   label:{fontSize:14,fontWeight:'700',marginTop:0}, 
   choiceRow:{flexDirection:'row',gap:10}, choice:{flex:1,borderWidth:1,borderRadius:Radius.md,padding:14,alignItems:'center'},
    input:{borderWidth:1,borderRadius:Radius.md,padding:12,minHeight:48,textAlignVertical:'top'}, 
    materialList:{gap:Spacing.xs},materialInput:{borderWidth:1,borderRadius:Radius.md,padding:Spacing.sm,gap:4},
    captureRow:{flexDirection:'row',alignItems:'center',gap:Spacing.md,marginTop:0},
    qtyInput:{borderWidth:1,borderRadius:Radius.sm,width:'100%',paddingHorizontal:10,paddingVertical:10,textAlign:'center'},
    materialPhoto:{borderWidth:1,borderStyle:'dashed',borderRadius:Radius.sm,width:'60%',height:154,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,overflow:'hidden'},
    materialPreview:{width:'100%',height:'100%'}, 
    save:{backgroundColor:'#10B981',padding:16,borderRadius:Radius.md,alignItems:'center'},
     saveText:{color:'#fff',fontWeight:'800'},confirmBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.45)',alignItems:'center',justifyContent:'center',padding:Spacing.xl},confirmCard:{width:'100%',maxWidth:340,borderRadius:Radius.lg,borderWidth:1,padding:Spacing.xl,alignItems:'center',gap:Spacing.md},confirmIcon:{width:64,height:64,borderRadius:32,backgroundColor:'#10B981',alignItems:'center',justifyContent:'center'},confirmTitle:{fontSize:21,fontWeight:'900'},confirmButton:{width:'100%',backgroundColor:'#10B981',borderRadius:Radius.md,padding:14,alignItems:'center'},printButton:{backgroundColor:'#1B2A4A',flexDirection:'row',justifyContent:'center',gap:8} });
