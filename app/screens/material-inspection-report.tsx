import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import { buildCsvContent, buildHtmlContent, shareCsvAsFile, sharePdfAsFile } from '../../utils/exportData';

const statusColor = (value?: string) => value === 'Passed' ? '#059669' : value === 'Failed' ? '#DC2626' : '#64748B';

export default function MaterialInspectionReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setLoading(false); setError('No job was selected.'); return; }
    fetchDeliveryOrders({ jobId: id })
      .then((records) => {
        const match = (records || []).find((record: any) => String(record.jobId || record.id) === String(id));
        if (match) setJob(match);
        else setError('The material inspection report could not be found.');
      })
      .catch(() => setError('Unable to load the material inspection report.'))
      .finally(() => setLoading(false));
  }, [id]);

  const materials = useMemo(() => {
    if (!job) return [];
    const receipts = Array.isArray(job.materialInspection?.materialReceipts) ? job.materialInspection.materialReceipts : [];
    const poMaterials = Array.isArray(job.materials) && job.materials.length
      ? job.materials
      : [{ materialId: job.materialId, materialName: job.materialName, quantity: job.quantityOrdered || job.quantityDispatched, unit: job.unit }];
    return poMaterials.map((material: any) => {
      const receipt = receipts.find((item: any) => String(item.materialId || '') === String(material.materialId || material.id || ''))
        || receipts.find((item: any) => item.materialName === material.materialName)
        || null;
      return { material, receipt };
    });
  }, [job]);

  const exportRows = useMemo(() => {
    if (!job) return [] as string[][];
    const inspection = job.materialInspection || {};
    const details = [
      ['MIF #', inspection.mrfNumber || 'Pending inspection'],
      ['Job ID', job.jobId || job.id || '—'],
      ['Purchase Order', job.poNumber || job.purchaseOrderId || '—'],
      ['Vendor', job.vendorName || '—'],
      ...(job.isWarehouseDelivery ? [['Origin', 'Warehouse'], ['Site Accepted At', job.warehouseAcceptedAt ? formatEAT(job.warehouseAcceptedAt) : 'Pending'], ['Accepted By', job.warehouseAcceptedByName || '']] : [['Driver / Truck', `${job.driverName || ''} / ${job.plateNumber || ''}`]]),
      ['Inspector', inspection.inspectorName || '—'],
      ['Inspected At', inspection.inspectedAt ? formatEAT(inspection.inspectedAt) : '—'],
    ];
    const materialRows = materials.flatMap(({ material, receipt }: any) => [
      [`${material.materialName || 'Material'} — Dispatched Quantity`, material.quantity != null ? `${material.quantity} ${material.unit || ''}`.trim() : '—'],
      [`${material.materialName || 'Material'} — Received Quantity`, receipt?.receivedQuantity != null ? `${receipt.receivedQuantity} ${receipt.unit || material.unit || ''}`.trim() : 'Not captured'],
      [`${material.materialName || 'Material'} — Initial Visual Inspection`, receipt?.initialVisualInspection || (inspection.mrfNumber ? 'N/A' : 'Pending')],
      ...(receipt?.failureReason ? [[`${material.materialName || 'Material'} — Failure Reason`, receipt.failureReason]] : []),
      ...(receipt?.deficiency ? [[`${material.materialName || 'Material'} — Deficiency`, receipt.deficiency]] : []),
      ...(Array.isArray(receipt?.photoURLs) && receipt.photoURLs.length ? [[`${material.materialName || 'Material'} — Photo URLs`, receipt.photoURLs.filter(Boolean).join('\n')]] : []),
    ] as string[][]);
    return [...details, ...materialRows];
  }, [job, materials]);

  const exportReport = async (format: 'csv' | 'pdf') => {
    if (!job) return;
    setExporting(format);
    const title = `Material_Inspection_Report_${job.materialInspection?.mrfNumber || job.jobId || job.id}`;
    try {
      if (format === 'csv') await shareCsvAsFile(title, buildCsvContent(['Field', 'Value'], exportRows));
      else await sharePdfAsFile(title, buildHtmlContent(['Field', 'Value'], exportRows, 'Material Inspection Report'));
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /><Text style={[styles.muted, { color: colors.textMuted }]}>Loading material inspection report...</Text></View>;
  if (error || !job) return <View style={[styles.center, { backgroundColor: colors.background }]}><Ionicons name="alert-circle-outline" size={48} color={colors.danger} /><Text style={[styles.muted, { color: colors.textMuted }]}>{error || 'Report not found.'}</Text></View>;

  const inspection = job.materialInspection || {};
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.report, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heading}>
          <Ionicons name="clipboard-outline" size={28} color="#0F766E" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>MATERIAL INSPECTION REPORT</Text>
            <Text style={[styles.mif, { color: '#0F766E' }]}>{inspection.mrfNumber || 'Pending inspection'}</Text>
          </View>
        </View>
        <Row label="Job ID" value={job.jobId || job.id} colors={colors} />
        <Row label="Purchase Order" value={job.poNumber || job.purchaseOrderId || '—'} colors={colors} />
        <Row label="Vendor" value={job.vendorName || '—'} colors={colors} />
        {job.isWarehouseDelivery ? <><Row label="Origin" value="Warehouse" colors={colors} /><Row label="Site Accepted At" value={job.warehouseAcceptedAt ? formatEAT(job.warehouseAcceptedAt) : 'Pending'} colors={colors} /><Row label="Accepted By" value={job.warehouseAcceptedByName || ''} colors={colors} /></> : <Row label="Driver / Truck" value={`${job.driverName || ''} / ${job.plateNumber || ''}`} colors={colors} />}
        <Row label="Inspector" value={inspection.inspectorName || '—'} colors={colors} />
        <Row label="Inspected At" value={inspection.inspectedAt ? formatEAT(inspection.inspectedAt) : '—'} colors={colors} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Materials on Purchase Order</Text>
      {materials.map(({ material, receipt }: any, index: number) => {
        const result = receipt?.initialVisualInspection || (inspection.mrfNumber ? 'N/A' : 'Pending');
        const photoURLs = Array.isArray(receipt?.photoURLs) ? receipt.photoURLs.filter(Boolean) : [];
        return <View key={`${material.materialId || material.id || material.materialName}-${index}`} style={[styles.materialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.materialName, { color: colors.text }]}>{material.materialName || 'Material'}</Text>
          <Row label="PO Quantity" value={material.quantity != null ? `${material.quantity} ${material.unit || ''}`.trim() : '—'} colors={colors} />
          <Row label="Received Quantity" value={receipt?.receivedQuantity != null ? `${receipt.receivedQuantity} ${receipt.unit || material.unit || ''}`.trim() : 'Not captured'} colors={colors} />
          <Row label="Initial Visual Inspection" value={result} colors={colors} valueColor={statusColor(result)} />
          {receipt?.failureReason ? <Row label="Failure Reason" value={receipt.failureReason} colors={colors} /> : null}
          {receipt?.deficiency ? <Row label="Deficiency" value={receipt.deficiency} colors={colors} /> : null}
          {photoURLs.length ? <View style={styles.photos}>{photoURLs.map((uri: string, photoIndex: number) => <TouchableOpacity key={`${uri}-${photoIndex}`} onPress={() => setSelectedImage(uri)} accessibilityRole="button" accessibilityLabel={`View ${material.materialName || 'material'} inspection photo`}><Image source={{ uri }} style={styles.photo} /></TouchableOpacity>)}</View> : null}
        </View>;
      })}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#2563EB', opacity: exporting ? 0.7 : 1 }]} onPress={() => { void exportReport('csv'); }} disabled={Boolean(exporting)}>
          <Ionicons name="download-outline" size={18} color="#FFFFFF" />
          <Text style={styles.actionText}>{exporting === 'csv' ? 'Preparing...' : 'Download CSV'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#0F766E', opacity: exporting ? 0.7 : 1 }]} onPress={() => { void exportReport('pdf'); }} disabled={Boolean(exporting)}>
          <Ionicons name="print-outline" size={18} color="#FFFFFF" />
          <Text style={styles.actionText}>{exporting === 'pdf' ? 'Preparing...' : 'Print PDF'}</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={Boolean(selectedImage)} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.imageModal}>
          <TouchableOpacity activeOpacity={1} style={styles.imageBackdrop} onPress={() => setSelectedImage(null)} accessibilityRole="button" accessibilityLabel="Close image viewer">
            {selectedImage ? <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" /> : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.imageModalClose} onPress={() => setSelectedImage(null)} accessibilityRole="button" accessibilityLabel="Close image viewer">
            <Ionicons name="close" size={20} color="#FFFFFF" />
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, value, colors, valueColor }: { label: string; value: string; colors: any; valueColor?: string }) {
  return <View style={styles.row}><Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.value, { color: valueColor || colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: {padding: Spacing.md,paddingTop:0, gap: Spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  muted: { marginTop: Spacing.xs, textAlign: 'center' },
  report: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1', paddingBottom: Spacing.sm, marginBottom: Spacing.xs },
  title: { fontSize: 15, fontWeight: '900' },
  mif: { fontSize: 13, fontWeight: '800', marginTop: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop:0 },
  materialCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  materialName: { fontSize: 15, fontWeight: '800', marginBottom:0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 3 },
  label: { width: '42%', fontSize: 13 },
  value: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  photo: { width: 90, height: 90, borderRadius: Radius.sm, backgroundColor: '#E2E8F0' },
  imageModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  imageBackdrop: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  imageModalClose: { position: 'absolute', bottom: Spacing['2xl'], alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: '#334155', borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  closeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  fullImage: { width: '100%', height: '85%' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.md, paddingVertical: Spacing.md },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
