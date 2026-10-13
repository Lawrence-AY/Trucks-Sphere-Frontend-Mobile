import { purchaseOrderRepository } from '../services/repositories/PurchaseOrderRepository';
import { getPurchaseOrderMaterials } from '../utils/poMaterials';
import { showAlert } from '../utils/webAlert';
import { formatTripMaterials } from '../utils/poMaterials';
import { hasReceipt, receiptReference, deliveryLot, receivingPerson, deliveryPerson } from '../utils/deliveryDocuments';
import { isWarehouseJob } from '../utils/warehouse';
import { readableTextColor } from '../utils/contrast';
import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Gap, Radius, Spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { buildCsvContent, buildHtmlContent, shareCsvAsFile, sharePdfAsFile } from '../utils/exportData';
import { generateReceiptNoteId } from '../utils/helpers';

type DocumentKind = 'delivery' | 'receipt' | 'purchaseOrder' | 'inspection';

type DocumentDefinition = {
  kind: DocumentKind;
  title: string;
  identifier: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  rows: string[][];
  available: boolean;
  unavailableMessage?: string;
};

type JobDocumentsProps = {
  job: any;
  /** Hide the receipt until the site operator has completed the weigh-out. */
  showReceiptNote?: boolean;
};

export function JobDocuments({ job, showReceiptNote = true }: JobDocumentsProps) {
  const colors = useTheme();
  const [exporting, setExporting] = useState<string | null>(null);
  const jobId = String(job?.jobId || job?.id || '');
  const poId = String(job?.purchaseOrderId || job?.poNumber || '');
  const receiptAvailable = hasReceipt(job);
  const warehouse = isWarehouseJob(job);
  const receiptNoteId = String(receiptReference(job) || 'Not recorded');
  const externalDeliveryNoteUrl = String(job?.deliveryNoteURL || job?.photoURL || '').trim();
  const materialsLabel = formatTripMaterials(job);

  const baseRows = [
    ['Job ID', jobId || '—'],
    [warehouse ? 'Warehouse Order' : 'Purchase Order', String(job?.poNumber || '—')],
    ['Vendor', String(job?.vendorName || job?.companyName || '—')],
    ['Driver', String(deliveryPerson(job) || '—')],
    ['Truck', String(job?.plateNumber || '—')],
    ['Materials dispatched', materialsLabel || '—'],
    ['Quarry / Source', String(job?.quarryName || '—')],
    ['Delivery Destination', String(job?.siteName || '—')],
  ];

  const documents: DocumentDefinition[] = [
    {
      kind: 'inspection',
      title: 'Material Inspection & Receipt Form',
      identifier: String(job?.materialInspection?.mrfNumber || 'Pending inspection'),
      icon: 'clipboard-outline',
      color: colors.tealText,
      rows: [
        ['MIF #', String(job?.materialInspection?.mrfNumber || 'Pending')],
        ['Materials dispatched', materialsLabel || '—'],
        ['Inspector', String(job?.materialInspection?.inspectorName || '—')],
        ['Material Inspection Details', (job?.materialInspection?.materialReceipts || []).map((line: any) => `${line.materialName || 'Material'}: ${line.receivedQuantity ?? ''} ${line.unit || ''} — ${line.initialVisualInspection || 'Pending'}${line.failureReason ? ` (${line.failureReason})` : ''}${line.deficiency ? `; deficiency: ${line.deficiency}` : ''}`).join('; ') || '—'],
      ],
      available: Boolean(job?.materialInspection?.mrfNumber),
      unavailableMessage: 'The material inspection must be completed before site weigh-out.',
    },
    {
      kind: 'delivery',
      title: 'Delivery Note',
      identifier: jobId || 'Pending',
      icon: 'document-text-outline',
      color: colors.infoBorder,
      rows: [['Delivery Note #', jobId || '—'], ...baseRows.slice(1), ['Status', String(job?.status || 'Pending')]],
      available: Boolean(jobId),
      unavailableMessage: 'The job reference is not available yet.',
    },
    {
      kind: 'receipt',
      title: 'Receipt Note',
      identifier: receiptNoteId,
      icon: 'receipt-outline',
      color: colors.successText,
      rows: [
        ['Receipt Note #', receiptNoteId],
        ['Lot Number', deliveryLot(job) || 'Not recorded'],
        ['Site Personnel', receivingPerson(job) || 'Not recorded'],
        ...baseRows,
        ['Delivered Quantity', `${job?.quantityDelivered || job?.siteNetWeight || '—'} ${job?.unit || ''}`.trim()],
        ['Received At', String(job?.receivedAt || job?.completionTime || '—')],
      ],
      available: receiptAvailable,
      unavailableMessage: 'The receipt note will be available once the delivery is received.',
    },
    {
      kind: 'purchaseOrder',
      title: warehouse ? 'Warehouse Order' : 'Purchase Order',
      identifier: String(job?.poNumber || poId || 'Pending'),
      icon: 'briefcase-outline',
      color: colors.purpleText,
      rows: [
        ['Purchase Order #', String(job?.poNumber || poId || '—')],
        ['Vendor', String(job?.vendorName || job?.companyName || '—')],
        ['Materials dispatched', materialsLabel || '—'],
        ['Job ID', jobId || '—'],
        ['Status', String(job?.status || 'Pending')],
      ],
      available: Boolean(poId),
      unavailableMessage: 'This job has no linked purchase order.',
    },
  ];

  function openDocument(document: DocumentDefinition) {
    if (!document.available) return;
    if (document.kind === 'delivery') {
      router.push(`/screens/delivery-note?id=${encodeURIComponent(jobId)}` as any);
      return;
    }
    if (document.kind === 'receipt') {
      router.push(`/screens/receipt-note?id=${encodeURIComponent(jobId)}` as any);
      return;
    }
    if (document.kind === 'inspection') {
      router.push(`/screens/material-inspection-report?id=${encodeURIComponent(jobId)}` as any);
      return;
    }
    router.push(`/screens/purchase-order?id=${encodeURIComponent(poId)}${warehouse ? '&warehouse=1' : ''}` as any);
  }

  async function exportDocument(document: DocumentDefinition, format: 'csv' | 'pdf') {
    if (!document.available) return;
    const key = `${document.kind}-${format}`;
    setExporting(key);
    try {
      let rows = document.rows;
      if (document.kind === 'purchaseOrder') {
        const order = await purchaseOrderRepository.getById(poId);
        if (!order) throw new Error('The linked order could not be loaded.');
        rows = [
          [warehouse ? 'Warehouse Order' : 'Purchase Order', String(order.poNumber || order.id)],
          ['Vendor', String(order.vendorName || '')],
          ['Materials', getPurchaseOrderMaterials(order).map((line, index) => (index + 1) + '. ' + line.materialName + ' (' + line.quantity + ' ' + (line.unit || '') + ')').join('\n')],
          ['Created At', String(order.createdAt || '')],
        ];
      }
      const title = `${document.title} ${document.identifier}`;
      if (format === 'csv') {
        await shareCsvAsFile(title, buildCsvContent(['Field', 'Value'], rows));
      } else {
        await sharePdfAsFile(title, buildHtmlContent(['Field', 'Value'], rows, title));
      }
    } catch (error: any) {
      await showAlert('Export failed', error?.message || 'Could not load the document.');
    } finally {
      setExporting(null);
    }
  }

  async function openExternalDeliveryNote() {
    if (!externalDeliveryNoteUrl) return;
    await Linking.openURL(externalDeliveryNoteUrl);
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Job Documents</Text>
      {externalDeliveryNoteUrl ? (
        <TouchableOpacity
          style={[styles.externalNote, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          onPress={() => { void openExternalDeliveryNote(); }}
          accessibilityRole="link"
          accessibilityLabel="View attached external delivery note"
        >
          <Ionicons name="document-attach-outline" size={20} color={colors.primaryText} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.externalNoteTitle, { color: colors.text }]}>External delivery note attached</Text>
            <Text style={[styles.externalNoteMeta, { color: colors.textSecondary }]} numberOfLines={1}>{job?.deliveryNoteFileName || 'View the captured note'}</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.infoText} />
        </TouchableOpacity>
      ) : null}
       {documents.filter((document) =>
         // The inspection form is a submitted inspector record, not a blank
         // template for other roles. Show it only after its MIF number exists.
         (document.kind !== 'receipt' || showReceiptNote || receiptAvailable)
         && (document.kind !== 'inspection' || document.available)
       ).map((document) => {
        const isExporting = exporting?.startsWith(`${document.kind}-`);
        return (
          <TouchableOpacity
            key={document.kind}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, !document.available && styles.cardDisabled]}
            onPress={() => openDocument(document)}
            disabled={!document.available || Boolean(isExporting)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${document.title}`}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: `${document.color}16` }]}>
                <Ionicons name={document.icon} size={22} color={readableTextColor(document.color, colors.surface)} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{document.title}</Text>
                <Text style={[styles.cardIdentifier, { color: document.available ? colors.primaryText : colors.textMuted }]} numberOfLines={1}>{document.identifier}</Text>
              </View>
            </View>
            {!document.available ? (
              <Text style={[styles.unavailable, { color: colors.textMuted }]}>{document.unavailableMessage}</Text>
            ) : (
              <View style={styles.actions}>
                <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.xs, gap: Gap},
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionSubtitle: { fontSize: 13, marginBottom: Spacing.xs},
  externalNote: { minHeight: 58, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Gap},
  externalNoteTitle: { fontSize: 13, fontWeight: '800' },
  externalNoteMeta: { fontSize: 11, fontWeight: '600', marginTop: Spacing.xs},
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Gap},
  cardDisabled: { opacity: 0.65 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Gap},
  iconWrap: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardIdentifier: { fontSize: 12, fontWeight: '700', marginTop: Spacing.xs},
  unavailable: { fontSize: 12, lineHeight: 17 },
  actions: { alignItems: 'flex-end' },
});
