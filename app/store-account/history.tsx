import { DateRangeFilter, defaultDateRange, DateRange, isInDateRange } from '../../components/DateRangeFilter';
﻿import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Searchbar } from 'react-native-paper';
import { StoreReceiptDetails } from '../../components/StoreReceiptDetails';
import { CommandHeader, DataCard, EmptyState, FilterRail, PageShell, SectionTitle } from '../../components/EnterpriseUI';
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
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending inspection' },
    { key: 'approved', label: 'Approved' },
    { key: 'flagged', label: 'Flagged' },
  ];
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
      const headers = ['Job ID', 'PO', 'Vendor', 'Material', 'Received Quantity', 'Unit', 'Workflow Status', 'Initial Condition', 'Rejection Reason', 'Received By', 'Received At (EAT)', 'Inspector', 'Inspected At (EAT)', 'Inspection Photos'];
      const rows = filtered.flatMap(job => receivedLines(job).map(line => [job.jobId || job.id, job.poNumber || job.purchaseOrderId || '', job.vendorName || '', line.materialName || '', String(line.receivedQuantity), line.unit || '', receivingStatusLabel(job), job.storeReceiving?.condition || line.initialVisualInspection || '', job.receivingFlag?.reason || line.failureReason || '', job.storeReceiving?.receivedByName || '', receivingDate(job.storeReceiving?.receivedAt), job.materialInspection?.inspectorName || '', receivingDate(job.materialInspection?.inspectedAt), (line.photoURLs || job.materialInspection?.photoURLs || []).join(' | ')]));
      await shareCsvAsFile(`Store Receiving ${new Date().toISOString().slice(0, 10)}`, buildCsvContent(headers, rows));
    } catch (error: any) { Alert.alert('Export failed', error.message || 'Could not export history.'); }
    finally { setExporting(false); }
  };
  return <>
    <PageShell>
      <CommandHeader title="Receiving history" subtitle="Review completed receipts and export the current results." right={
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Download receiving history as CSV" disabled={exporting} onPress={() => void exportHistory()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, opacity: exporting ? 0.65 : 1 }}>
          <Ionicons name="download-outline" size={18} color={colors.onPrimary} />
          <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>{exporting ? 'Preparing CSV…' : 'Download CSV'}</Text>
        </TouchableOpacity>
      } />
      <Searchbar
        placeholder="Search job, PO, vendor or material"
        value={search}
        onChangeText={setSearch}
        accessibilityLabel="Search receiving history"
        iconColor={colors.textMuted}
        placeholderTextColor={colors.textMuted}
        style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, elevation: 0 }}
        inputStyle={{ color: colors.text, minHeight: 0, fontSize: 14 }}
      />
      <FilterRail options={filters} value={filter} onChange={setFilter} />
      <DateRangeFilter value={dateRange || defaultDateRange()} onApply={setDateRange} />
      <SectionTitle title={`${filtered.length} receipt${filtered.length === 1 ? '' : 's'}`} />
      {!filtered.length ? (
        <EmptyState icon="file-tray-outline" title="No receiving records found" subtitle="Try changing your search, status, or date range." />
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map(job => {
            const flagged = job.receivingFlag?.status === 'flagged' || receivedLines(job).some(line => line.initialVisualInspection === 'Failed');
            return (
              <DataCard key={job.id} onPress={() => setSelected(job)} contentStyle={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{job.jobId || job.id}</Text>
                    <Text style={{ color: colors.textMuted }}>{job.vendorName || 'Unknown vendor'} · PO {job.poNumber || job.purchaseOrderId || '—'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: flagged ? `${colors.danger}16` : `${colors.primary}14`, maxWidth: '100%' }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: flagged ? colors.danger : colors.primary }} />
                    <Text style={{ color: flagged ? colors.danger : colors.primaryText, fontSize: 11, fontWeight: '800' }}>{receivingStatusLabel(job)}</Text>
                  </View>
                </View>
                <View style={{ gap: 7 }}>
                  {receivedLines(job).map((line, index) => (
                    <View key={`${job.id}-line-${index}`} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: colors.textSecondary, flex: 1, minWidth: 120 }}>{line.materialName || 'Material'}</Text>
                      <Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1 }}>{line.receivedQuantity} {line.unit || ''}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 8 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Received {receivingDate(job.storeReceiving?.receivedAt || job.materialInspection?.inspectedAt)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: '700' }}>Details</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primaryText} />
                  </View>
                </View>
              </DataCard>
            );
          })}
        </View>
      )}
    </PageShell>
    <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 }}><View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 20, maxHeight: '90%', width: '100%', maxWidth: 680 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 14 }}>{selected?.jobId || 'Receiving details'}</Text>
        <ScrollView>{selected ? <StoreReceiptDetails job={selected} /> : null}</ScrollView>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 14 }}><Text style={{ color: colors.primary, textAlign: 'center' }}>Close</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </>;
}
