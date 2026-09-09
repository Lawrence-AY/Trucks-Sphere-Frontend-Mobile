import { ReportActions } from '../../components/ReportActions';
import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { fetchDeliveryOrders } from '../../services/api';
import { buildCsvContent, buildHtmlContent, shareCsvAsFile, sharePdfAsFile } from '../../utils/exportData';
import { Spacing, Radius } from '../../constants/theme';

export default function InspectorReportsScreen() {
  const colors = useTheme(); const [orders, setOrders] = useState<any[]>([]); const [refreshing, setRefreshing] = useState(false); const [exporting, setExporting] = useState(false);
  const load = useCallback(async () => setOrders((await fetchDeliveryOrders()).filter((job: any) => job.materialInspection?.mrfNumber)), []);
  useEffect(() => { void load(); }, [load]);
  const rows = orders.flatMap((job) => (job.materialInspection.materialReceipts || [{ materialName: job.materialName, receivedQuantity: '', unit: job.unit }]).map((line: any) => [job.materialInspection.mrfNumber, job.jobId, job.poNumber || '', line.materialName || '', String(line.orderedQuantity ?? ''), String(line.receivedQuantity ?? ''), line.unit || '', line.initialVisualInspection || job.materialInspection.initialVisualInspection || '', job.materialInspection.inspectorName || '', job.isWarehouseDelivery ? 'Warehouse' : 'Quarry', job.warehouseAcceptedAt || '', job.warehouseAcceptedByName || '']));
  const exportReport = async (format: 'csv' | 'pdf') => { if (!rows.length) return Alert.alert('No inspections', 'There are no completed material inspections to report.'); setExporting(true); try { const headers = ['MIF #','Job ID','PO #','Material','PO Qty','Received Qty','Unit','Result','Inspector','Origin','Site Accepted At','Site Accepted By']; const title = 'Material Inspection Report'; if (format === 'csv') await shareCsvAsFile(title, buildCsvContent(headers, rows)); else await sharePdfAsFile(title, buildHtmlContent(headers, rows, title)); } finally { setExporting(false); } };
  return <ScrollView style={[styles.page,{backgroundColor:colors.background}]} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.accent} />}><View style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border}]}><Ionicons name="bar-chart-outline" size={28} color="#0F766E"/><Text style={[styles.title,{color:colors.text}]}>Material Inspection Report</Text><Text style={{color:colors.textMuted}}>{rows.length} material receipt line{rows.length === 1 ? '' : 's'} captured</Text><ReportActions categories={[{ key: 'pdf', label: 'Inspections PDF' }, { key: 'csv', label: 'Inspections CSV' }]} busy={exporting} onExport={key => { void exportReport(key as 'csv' | 'pdf'); }} /></View></ScrollView>;
}
const styles = StyleSheet.create({page:{flex:1},content:{padding:Spacing.lg,paddingBottom:Spacing.xs},card:{borderWidth:1,borderRadius:Radius.lg,padding:Spacing.lg,gap:Spacing.md},title:{fontSize:18,fontWeight:'800'},primary:{backgroundColor:'#0F766E',borderRadius:Radius.md,padding:14,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'800'},secondary:{borderWidth:1,borderRadius:Radius.md,padding:14,alignItems:'center'} });
