import { InspectionChoice } from '../../components/InspectionChoice';
import { SearchField } from '../../components/EnterpriseUI';
import { getTripMaterials } from '../../utils/poMaterials';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Gap, Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders, fetchPurchaseOrders, updateDeliveryOrder } from '../../services/api';
import { useAuthStore } from '@/store/authStore';
import { getInspectorSelection, setInspectorSelection } from '../../utils/inspectorSelection';
import { buildCsvContent, buildHtmlContent, shareCsvAsFile, sharePdfAsFile } from '../../utils/exportData';
import { useDeliveryOrders } from '@/store/realtimeData';
import { isWarehouseJob } from '../../utils/warehouse';
import { isAwaitingInspection } from '../../utils/inspection';

const materialLines = getTripMaterials;

const materialList = (job: any, purchaseOrders: any[] = []) => materialLines(job, purchaseOrders)
  .map((item: any) => `${item.materialName || 'Material'}${item.quantity != null ? ` — ${item.quantity} ${item.unit || ''}` : ''}`).join('\n');

const GENERAL_QUALITY_METRICS = ['Material identity / grade verified', 'No contamination or foreign material', 'Acceptable moisture and physical condition'];

const FAILURE_REASONS = ['Damaged', 'Spoiled', 'Contaminated', 'Wrong material or grade', 'Short quantity', 'Other'];

export default function InspectorScreen() {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const { user } = useAuthStore();
  const realtimeDeliveries = useDeliveryOrders();
  const { jobId, id } = useLocalSearchParams<{ jobId?: string; id?: string }>();
  const [jobs, setJobs] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [materialChecks, setMaterialChecks] = useState<Record<string, { result: '' | 'Pass' | 'Failed'; reason: string; deficiency: string }>>({});
  const [qualityChecks, setQualityChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [reasonChoice, setReasonChoice] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [confirmation, setConfirmation] = useState<{ mrfNumber: string; materialCount: number; jobId: string; poNumber: string; materialReceipts: any[]; inspectorName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  const initializedInspection = useRef<string | null>(null);
  const form = useMemo(() => active?.materialInspection || {}, [active]);
  const activeMaterialLines = useMemo(() => materialLines(active, purchaseOrders), [active, purchaseOrders]);
  useEffect(() => {
    if (!active) { initializedInspection.current = null; return; }
    if (initializedInspection.current === active.id) return;
    initializedInspection.current = active.id;
    const lines = activeMaterialLines;
    setQualityChecks(Object.fromEntries(lines.map((line: any, index: number) => [String(line.materialId || index), form.materialReceipts?.find((receipt: any) => String(receipt.materialId || '') === String(line.materialId || ''))?.qualityChecks || {}])));
    setMaterialChecks(Object.fromEntries(lines.map((line: any, index: number) => {
      const receipt = form.materialReceipts?.find((item: any) => String(item.materialId || '') === String(line.materialId || '')) || {};
      const key = String(line.materialId || index);
      return [key, { result: receipt.initialVisualInspection === 'Pass' || receipt.initialVisualInspection === 'Failed' ? receipt.initialVisualInspection : '', reason: receipt.failureReason || '', deficiency: receipt.deficiency || '' }];
    })));
  }, [active, activeMaterialLines, form]);

  const save = async () => {
    if (!active || saving || active.id === savedJobId) return;
    const lines = activeMaterialLines;
    const materialReceipts = lines.map((line: any, index: number) => { const key = String(line.materialId || index); const check = materialChecks[key] || { result: '', reason: '', deficiency: '' }; return { materialId: line.materialId || String(index), materialName: line.materialName || 'Material', unit: line.unit || active.unit || '', orderedQuantity: Number(line.quantity || 0), receivedQuantity: Number(line.quantity || 0), initialVisualInspection: check.result || 'Pending', failureReason: check.result === 'Failed' ? check.reason.trim() : '', deficiency: check.deficiency.trim() }; });
    const incompleteQuality = lines.find((line: any, index: number) => {
      const key = String(line.materialId || index);
      const result = materialChecks[key]?.result;
      return !['Pass', 'Failed'].includes(result || '') || (result === 'Pass' && GENERAL_QUALITY_METRICS.some((metric) => qualityChecks[key]?.[metric] !== true));
    });
    if (incompleteQuality) return Alert.alert('Quality checklist required', 'Check every general metric before choosing Pass. A failed inspection requires a reason.');
    materialReceipts.forEach((receipt: any, index: number) => { const line = lines[index]; receipt.qualityChecks = qualityChecks[String(line.materialId || index)] || {}; });
    if (materialReceipts.some((line: any) => line.initialVisualInspection === 'Failed' && !line.failureReason)) return Alert.alert('Reason required', 'Enter a failure reason for every material marked Failed.');
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
      setSavedJobId(active.id);
      setConfirmation({ mrfNumber: inspection.materialInspection?.mrfNumber || 'MIF', materialCount: materialReceipts.length, jobId: active.jobId || active.id, poNumber: active.poNumber || '', materialReceipts, inspectorName: user?.displayName || user?.email || 'Inspector' });
      // Keep the completion dialog mounted until the Inspector explicitly
      // chooses an action. Refreshing here clears the active job and causes
      // the modal to disappear before it can be confirmed.
    } catch (error: any) { Alert.alert('Could not save inspection', error?.message || 'Please try again.'); }
    finally { setSaving(false); }
  };
  const printInspectionPdf = async () => {
    if (!confirmation) return;
    setPrinting(true);
    try {
      const headers = ['MIF #', 'Job ID', 'PO #', 'Material', 'PO Qty', 'Received Qty', 'Damaged Qty', 'Unit', 'Result', 'Failure reason', 'Deficiency', 'Inspector'];
      const rows = confirmation.materialReceipts.map((line: any) => [confirmation.mrfNumber, confirmation.jobId, confirmation.poNumber, line.materialName || '', String(line.orderedQuantity ?? ''), String(line.receivedQuantity ?? ''), String(line.damagedQuantity ?? ''), line.unit || '', line.initialVisualInspection || 'Pending', line.failureReason || '', line.deficiency || '', confirmation.inspectorName]);
      await sharePdfAsFile(`Material Inspection Form - ${confirmation.mrfNumber}`, buildHtmlContent(headers, rows, 'Material Inspection Form'));
    } catch (error: any) { Alert.alert('Print error', error?.message || 'Could not create the PDF.'); }
    finally { setPrinting(false); }
  };
  const exportInspectionCsv = async () => {
    if (!confirmation) return;
    const headers = ['MIF #', 'Job ID', 'PO #', 'Material', 'PO Qty', 'Received Qty', 'Damaged Qty', 'Unit', 'Result', 'Failure reason', 'Deficiency', 'Inspector'];
    const rows = confirmation.materialReceipts.map((line: any) => [confirmation.mrfNumber, confirmation.jobId, confirmation.poNumber, line.materialName || '', String(line.orderedQuantity ?? ''), String(line.receivedQuantity ?? ''), String(line.damagedQuantity ?? ''), line.unit || '', line.initialVisualInspection || 'Pending', line.failureReason || '', line.deficiency || '', confirmation.inspectorName]);
    try { await shareCsvAsFile(`Material Inspection Form - ${confirmation.mrfNumber}`, buildCsvContent(headers, rows)); } catch (error: any) { Alert.alert('Export error', error?.message || 'Could not create the CSV.'); }
  };

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  if (!active) return <ScrollView style={[styles.page, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={colors.accent} />}>
     <SearchField title="Inspections" icon="clipboard-outline" value={search} onChangeText={setSearch} placeholder="Search dispatch, job, material, driver or lot" />
     {jobs.filter((job) => !search.trim() || [job.jobId, job.driverName, job.plateNumber, job.materialName, job.storageLot, job.lotNumber, job.destinationLot].some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))).map((job) => <TouchableOpacity key={job.id} disabled={openingJobId === job.id} onPress={() => { if (openingJobId) return; setOpeningJobId(job.id); setInspectorSelection(job); router.push(`/inspector/inspect/${encodeURIComponent(job.id)}` as any); setTimeout(() => setOpeningJobId(null), 1000); }} 
     style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, openingJobId === job.id && { opacity: .65 }]}>
      <Text style={[styles.jobId, { color: colors.text }]}>{job.jobId}</Text>
      <Text style={{ color: colors.textMuted }}>{isWarehouseJob(job) ? 'Warehouse delivery' : `${job.driverName || 'Unassigned'} · ${job.plateNumber || 'N/A'}`}</Text>
      <Text style={[styles.materials, { color: colors.text }]}>{materialList(job, purchaseOrders)}</Text><Text style={{ color: colors.textMuted }}>Lot: {job.storageLot || job.lotNumber || job.destinationLot || 'Not assigned yet'}</Text>
      <Text style={{ color: job.materialInspection?.mrfNumber ? colors.success : colors.warningText, fontWeight: '700' }}>{job.materialInspection?.mrfNumber ? `${job.materialInspection.mrfNumber} — completed` : 'Inspection pending'}</Text>
    </TouchableOpacity>)}
    {!jobs.length && <Text style={{ color: colors.textMuted }}>No arrivals are awaiting inspection.</Text>}
  </ScrollView>;

  return <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">

    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.jobId, { color: colors.text }]}>{active.jobId}</Text>
      <Text style={{ color: colors.textMuted, marginTop: 4 }}>Site lot: {active.storageLot || active.lotNumber || active.destinationLot || 'Not assigned yet'}</Text>
      <Text style={[styles.materials, { color: colors.text }]}>{materialList(active, purchaseOrders)}</Text></View>
    <Text style={[styles.label, { color: colors.text }]}>Material inspections</Text>
    <View style={styles.materialList}>{activeMaterialLines.map((line: any, index: number) => { const key = String(line.materialId || index); return <View key={key} style={[styles.materialInput, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{line.materialName || 'Material'}</Text>{<View style={{ gap: Gap, marginTop: 4 }}><Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>General material quality checklist</Text>{GENERAL_QUALITY_METRICS.map((metric) => <TouchableOpacity key={metric} accessibilityRole="checkbox" accessibilityLabel={metric} accessibilityState={{ checked: qualityChecks[key]?.[metric] === true }} disabled={saving} onPress={() => setQualityChecks((current) => ({ ...current, [key]: { ...(current[key] || {}), [metric]: !current[key]?.[metric] } }))} style={{ flexDirection: 'row', alignItems: 'center', gap: Gap, minHeight: 44 }}>
        <Ionicons name={qualityChecks[key]?.[metric] ? 'checkbox' : 'square-outline'} size={24} color={qualityChecks[key]?.[metric] ? colors.success : colors.textMuted} />
        <Text style={{ color: colors.text, flex: 1 }}>{metric}</Text>
      </TouchableOpacity>)}</View>}
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Initial visual inspection</Text>
      <InspectionChoice label="Overall inspection" value={materialChecks[key]?.result || ''} disabled={saving} onChange={(result) => {
        setMaterialChecks((current) => ({ ...current, [key]: { ...(current[key] || { reason: '', deficiency: '' }), result } }));

      }} />
      <Text accessibilityLiveRegion="polite" style={{ color: materialChecks[key]?.result === 'Failed' ? colors.danger : colors.text }}>{materialChecks[key]?.result === 'Pass' ? 'Inspection passed' : materialChecks[key]?.result === 'Failed' ? 'Inspection failed. Enter the failure reason below.' : 'Choose Pass or Fail'}</Text>
      {materialChecks[key]?.result === 'Failed' ? <><Text style={{ color: colors.textMuted, fontSize: 12 }}>Failure reason *</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Gap, marginTop: 4 }}>{FAILURE_REASONS.map((reason) => { const selected = reasonChoice[key] === reason; return <TouchableOpacity key={reason} disabled={saving} onPress={() => { setReasonChoice((current) => ({ ...current, [key]: reason })); setMaterialChecks((current) => ({ ...current, [key]: { ...(current[key] || { result: 'Failed', deficiency: '' }), reason: reason === 'Other' ? '' : reason } })); }} style={{ borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 }}><Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '700' }}>{reason}</Text></TouchableOpacity>; })}</View>{reasonChoice[key] === 'Other' ? <TextInput inputAccessoryViewID="trucksphere-keyboard-done" value={materialChecks[key]?.reason || ''} onChangeText={(value) => setMaterialChecks((current) => ({ ...current, [key]: { ...(current[key] || { result: 'Failed', deficiency: '' }), reason: value } }))} multiline style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="Describe why this material failed" placeholderTextColor={colors.textMuted}/> : null}</> : null}
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Deficiency (if any)</Text><TextInput inputAccessoryViewID="trucksphere-keyboard-done" value={materialChecks[key]?.deficiency || ''} onChangeText={(value) => setMaterialChecks((current) => ({ ...current, [key]: { ...(current[key] || { result: '', reason: '' }), deficiency: value } }))} multiline style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} placeholder="Material-specific deficiency" placeholderTextColor={colors.textMuted}/>
    
    </View>; })}</View>
    <TouchableOpacity onPress={save} disabled={saving || active.id === savedJobId} style={[styles.save, { opacity: saving || active.id === savedJobId ? .6 : 1 }]}><Text style={styles.saveText}>{saving ? 'Saving…' : active.id === savedJobId ? 'Inspection saved' : 'Confirm inspection'}</Text></TouchableOpacity>
  <Modal visible={Boolean(confirmation)} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}>
    <View style={styles.confirmBackdrop}><View style={[styles.confirmCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
      <View style={styles.confirmIcon}><Ionicons name="checkmark" size={34} color={colors.onPrimary}/></View>
      <Text style={[styles.confirmTitle,{color:colors.text}]}>Inspection submitted</Text><Text style={{color:colors.textMuted,textAlign:'center'}}>The inspection was saved successfully. You can now print or export the inspection documents.</Text><View style={{ flexDirection: 'row', gap: Gap, width: '100%', marginTop: 12 }}><TouchableOpacity onPress={() => { void printInspectionPdf(); }} disabled={printing} style={[styles.confirmButton,styles.printButton,{flex:1,opacity:printing ? .6 : 1}]}><Ionicons name="print-outline" size={18} color={colors.onPrimary}/><Text style={styles.saveText}>{printing?'Preparing PDF…':'Print PDF'}</Text></TouchableOpacity><TouchableOpacity onPress={() => { void exportInspectionCsv(); }} style={[styles.confirmButton,{flex:1,backgroundColor:colors.primary}]}><Ionicons name="download-outline" size={18} color={colors.onPrimary}/><Text style={styles.saveText}>Export CSV</Text></TouchableOpacity></View><TouchableOpacity onPress={() => { setConfirmation(null); setActive(null); }} style={[styles.confirmButton,{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,marginTop:10}]}><Text style={{color:colors.text,fontWeight:'800'}}>Done</Text></TouchableOpacity></View></View></Modal>
  </ScrollView></KeyboardAvoidingView>;
}
const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({ page:{flex:1}, content:{padding: Spacing.md,paddingTop:0,
  gap: Gap}, titleRow:{gap: Gap,marginBottom:Spacing.sm}, 
  title:{fontSize:22,fontWeight:'800'}, 
  subtitle:{fontSize:14}, card:{borderWidth:1,borderRadius:Radius.lg,padding:Spacing.md,gap: Gap},
   jobId:{fontSize:16,fontWeight:'800'}, materials:{fontSize:14,lineHeight:21}, 
   label:{fontSize:14,fontWeight:'700',marginTop:0}, 
   choiceRow:{flexDirection:'row',gap: Gap}, choice:{flex:1,borderWidth:1,borderRadius:Radius.md,padding:14,alignItems:'center'},
    input:{borderWidth:1,borderRadius:Radius.md,padding:12,minHeight:48,textAlignVertical:'top'}, 
    materialList:{gap: Gap},materialInput:{borderWidth:1,borderRadius:Radius.md,padding:Spacing.sm,gap: Gap},
    captureRow:{flexDirection:'row',alignItems:'center',gap: Gap,marginTop:0},
    qtyInput:{borderWidth:1,borderRadius:Radius.sm,width:'100%',paddingHorizontal:10,paddingVertical:10,textAlign:'center'},
    materialPhoto:{borderWidth:1,borderStyle:'dashed',borderRadius:Radius.sm,width:'60%',height:154,flexDirection:'row',alignItems:'center',justifyContent:'center',gap: Gap,overflow:'hidden'},
    materialPreview:{width:'100%',height:'100%'}, 
    save:{backgroundColor:colors.success,padding:16,borderRadius:Radius.md,alignItems:'center'},
     saveText:{color:colors.onPrimary,fontWeight:'800'},confirmBackdrop:{flex:1,backgroundColor:colors.overlay,alignItems:'center',justifyContent:'center',padding:Spacing.xl},confirmCard:{width:'100%',maxWidth:340,borderRadius:Radius.lg,borderWidth:1,padding:Spacing.xl,alignItems:'center',gap: Gap},confirmIcon:{width:64,height:64,borderRadius:32,backgroundColor:colors.success,alignItems:'center',justifyContent:'center'},confirmTitle:{fontSize:21,fontWeight:'900'},confirmButton:{width:'100%',backgroundColor:colors.success,borderRadius:Radius.md,padding:14,alignItems:'center'},printButton:{backgroundColor:colors.primary,flexDirection:'row',justifyContent:'center',gap: Gap} });
