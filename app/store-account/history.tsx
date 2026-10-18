import { DateRangeFilter, defaultDateRange, DateRange, isInDateRange } from '../../components/DateRangeFilter';
﻿import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SearchField } from '../../components/EnterpriseUI';
import { StoreReceiptDetails } from '../../components/StoreReceiptDetails';
import { useDeliveryOrders } from '../../store/realtimeData';
import { useTheme } from '../../hooks/useTheme';
import { buildCsvContent, shareCsvAsFile } from '../../utils/exportData';
import { receivedLines, receivingDate, receivingStatusLabel } from '../../utils/storeReceiving';

export default function StoremanHistoryScreen() {
  const colors = useTheme();
  const jobs = useDeliveryOrders();
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const filtered = useMemo(() => jobs.filter(job => {
    if (!job.receivingStatus && !job.materialInspection?.materialReceipts?.length) return false;
    if (!isInDateRange(job.storeReceiving?.receivedAt || job.materialInspection?.inspectedAt || job.updatedAt || job.createdAt, dateRange)) return false;
    const failed = job.receivingFlag?.status === 'flagged' || receivedLines(job).some(line => line.initialVisualInspection === 'Failed');
    if (filter === 'flagged' && !failed) return false;
    if (filter === 'pending' && job.receivingStatus !== 'received_pending_inspection') return false;
    if (filter === 'approved' && (failed || (job.receivingStatus && job.receivingStatus !== 'inventory_added'))) return false;
    return !search.trim() || [job.jobId, job.poNumber, job.vendorName, ...receivedLines(job).map(line => line.materialName)].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()));
  }), [jobs, filter, search, dateRange]);
  const exportHistory = async () => {
    setExporting(true);
    try {
      const headers = ['Job ID', 'PO', 'Vendor', 'Material', 'Received Quantity', 'Unit', 'Workflow Status', 'Initial Condition', 'Rejection Reason', 'Received By', 'Received At (EAT)', 'Inspector', 'Inspected At (EAT)'];
      const rows = filtered.flatMap(job => receivedLines(job).map(line => [job.jobId || job.id, job.poNumber || job.purchaseOrderId || '', job.vendorName || '', line.materialName || '', String(line.receivedQuantity), line.unit || '', receivingStatusLabel(job), job.storeReceiving?.condition || line.initialVisualInspection || '', job.receivingFlag?.reason || line.failureReason || '', job.storeReceiving?.receivedByName || '', receivingDate(job.storeReceiving?.receivedAt), job.materialInspection?.inspectorName || '', receivingDate(job.materialInspection?.inspectedAt)]));
      await shareCsvAsFile(`Store Receiving ${new Date().toISOString().slice(0, 10)}`, buildCsvContent(headers, rows));
    } catch (error: any) { Alert.alert('Export failed', error.message || 'Could not export history.'); }
    finally { setExporting(false); }
  };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <DateRangeFilter value={dateRange || defaultDateRange()} onApply={setDateRange} />
      <SearchField title="Receiving history" icon="time-outline" value={search} onChangeText={setSearch} placeholder="Search job, PO, vendor or material" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{[['all', 'All'], ['pending', 'Pending Inspection'], ['approved', 'Approved'], ['flagged', 'Flagged']].map(([key, label]) => <TouchableOpacity key={key} onPress={() => setFilter(key)} style={{ padding: 10, borderRadius: 8, backgroundColor: filter === key ? colors.primary : colors.surface }}><Text style={{ color: filter === key ? colors.onPrimary : colors.text }}>{label}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity disabled={exporting} onPress={() => void exportHistory()}><Text style={{ color: colors.primary }}>{exporting ? 'Exporting…' : 'Download CSV'}</Text></TouchableOpacity>
      {!filtered.length ? <Text style={{ color: colors.textMuted }}>No receiving records found.</Text> : filtered.map(job => <TouchableOpacity key={job.id} onPress={() => setSelected(job)} style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>{job.jobId || job.id}</Text>
        <Text style={{ color: job.receivingFlag?.status === 'flagged' ? colors.danger : colors.primary }}>{receivingStatusLabel(job)}</Text>
        <Text style={{ color: colors.textMuted }}>{job.vendorName || '—'} · Received: {receivingDate(job.storeReceiving?.receivedAt || job.materialInspection?.inspectedAt)}</Text>
        <Text style={{ color: colors.text }}>{receivedLines(job).map(line => `${line.materialName}: ${line.receivedQuantity} ${line.unit || ''}`).join('\n')}</Text>
        <Text style={{ color: colors.primary }}>View details and photos</Text>
      </TouchableOpacity>)}
    </ScrollView>
    <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 }}><View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 20, maxHeight: '90%' }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 14 }}>{selected?.jobId || 'Receiving details'}</Text>
        <ScrollView>{selected ? <StoreReceiptDetails job={selected} /> : null}</ScrollView>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 14 }}><Text style={{ color: colors.primary, textAlign: 'center' }}>Close</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </View>;
}
