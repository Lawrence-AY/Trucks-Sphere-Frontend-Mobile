import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDeliveryOrders } from '@/store/realtimeData';
import { useTheme } from '../../hooks/useTheme';
import { buildCsvContent, shareCsvAsFile } from '../../utils/exportData';

const eat = (value: any) => value ? new Date(value).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—';

export default function StoremanHistoryScreen() {
  const colors = useTheme();
  const jobs = useDeliveryOrders();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [selected, setSelected] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const completed = useMemo(() => jobs.filter((job: any) => job.materialInspection?.materialReceipts?.length), [jobs]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return completed.filter((job: any) => {
      const lines = job.materialInspection.materialReceipts || [];
      const matchesSearch = !query || [job.jobId, job.poNumber, job.purchaseOrderId, job.vendorName, ...lines.map((line: any) => line.materialName)].some((value) => String(value || '').toLowerCase().includes(query));
      const hasFailed = lines.some((line: any) => String(line.initialVisualInspection).toLowerCase() === 'failed');
      return matchesSearch && (filter === 'all' || (filter === 'failed' ? hasFailed : !hasFailed));
    });
  }, [completed, filter, search]);
  const exportHistory = async () => {
    setExporting(true);
    try {
      const headers = ['Job ID', 'MRF', 'PO Number', 'Vendor', 'Material', 'Quantity Received', 'Unit', 'Status', 'Failure / Deficiency', 'Inspector', 'Inspected At (EAT)'];
      const rows = filtered.flatMap((job: any) => (job.materialInspection.materialReceipts || []).map((line: any) => [job.jobId || job.id, job.materials?.find((item: any) => item.materialId === line.materialId)?.mrfNo || '', job.poNumber || job.purchaseOrderId || '', job.vendorName || '', line.materialName || job.materialName || '', String(line.receivedQuantity ?? ''), line.unit || '', line.initialVisualInspection || 'Pending', line.failureReason || line.deficiency || '', job.materialInspection.inspectorName || 'Storeman', eat(job.materialInspection.inspectedAt || job.updatedAt)]));
      await shareCsvAsFile(`Storeman History ${new Date().toISOString().slice(0, 10)}`, buildCsvContent(headers, rows));
    } catch (error: any) { Alert.alert('Export failed', error?.message || 'Could not export history.'); } finally { setExporting(false); }
  };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Receiving history</Text><TouchableOpacity disabled={exporting} onPress={() => void exportHistory()} style={{ backgroundColor: colors.primary, padding: 10, borderRadius: 8 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{exporting ? 'Exporting...' : 'Download CSV'}</Text></TouchableOpacity></View>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search job, PO, vendor or material" placeholderTextColor={colors.textMuted} style={{ color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['all', 'passed', 'failed'] as const).map((value) => <TouchableOpacity key={value} onPress={() => setFilter(value)} style={{ borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: filter === value ? colors.primary : colors.surface, borderWidth: 1, borderColor: filter === value ? colors.primary : colors.border }}><Text style={{ color: filter === value ? '#fff' : colors.text, fontWeight: '700' }}>{value === 'all' ? 'All' : value === 'passed' ? 'Passed' : 'Failed'}</Text></TouchableOpacity>)}</View>
      <Text style={{ color: colors.textMuted }}>{filtered.length} finalized deliveries</Text>
      {!filtered.length ? <Text style={{ color: colors.textMuted, marginTop: 20 }}>No finalized deliveries found.</Text> : filtered.map((job: any) => <TouchableOpacity key={job.id} onPress={() => setSelected(job)} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 14, gap: 5 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{job.jobId || job.id}</Text><Text style={{ color: colors.textMuted }}>PO: {job.poNumber || job.purchaseOrderId || '—'} · Vendor: {job.vendorName || '—'}</Text><Text style={{ color: colors.textMuted }}>Inspected: {eat(job.materialInspection?.inspectedAt || job.updatedAt)}</Text>{job.materialInspection.materialReceipts.map((line: any, index: number) => <Text key={`${job.id}-${index}`} style={{ color: colors.text }}>{line.materialName}: {line.receivedQuantity ?? '—'} {line.unit || ''} · {line.initialVisualInspection || 'Pending'}</Text>)}<Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>View receipt preview</Text></TouchableOpacity>)}
    </ScrollView>
    <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.4)' }}><View style={{ backgroundColor: colors.surface, padding: 18, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' }}><Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Receipt preview</Text><Text style={{ color: colors.textMuted, marginTop: 6 }}>{selected?.jobId || selected?.id} · {eat(selected?.materialInspection?.inspectedAt || selected?.updatedAt)}</Text>{selected?.materialInspection?.materialReceipts?.map((line: any, index: number) => <View key={index} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{line.materialName || 'Material'}</Text><Text style={{ color: colors.textMuted }}>Received: {line.receivedQuantity ?? '—'} {line.unit || ''} · {line.initialVisualInspection || 'Pending'}</Text>{line.failureReason || line.deficiency ? <Text style={{ color: colors.danger }}>Issue: {line.failureReason || line.deficiency}</Text> : null}</View>)}<TouchableOpacity onPress={() => setSelected(null)} style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 14 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Close preview</Text></TouchableOpacity></View></View></Modal>
  </View>;
}
