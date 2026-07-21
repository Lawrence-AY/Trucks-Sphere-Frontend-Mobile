import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Radius, Spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { buildCsvContent, buildHtmlContent, shareCsvAsFile, sharePdfAsFile } from '../utils/exportData';
import { generateReceiptNoteId } from '../utils/helpers';

type DocumentKind = 'delivery' | 'receipt' | 'purchaseOrder';

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
  const receiptAvailable = Boolean(jobId);
  const receiptNoteId = String(job?.receiptNoteId || (jobId ? generateReceiptNoteId(jobId) : 'Pending'));

  const baseRows = [
    ['Job ID', jobId || '—'],
    ['Purchase Order', String(job?.poNumber || '—')],
    ['Vendor', String(job?.vendorName || job?.companyName || '—')],
    ['Driver', String(job?.driverName || '—')],
    ['Truck', String(job?.plateNumber || '—')],
    ['Material', String(job?.materialName || '—')],
    ['Quantity', `${job?.quantityDispatched || job?.quantityOrdered || '—'} ${job?.unit || ''}`.trim()],
    ['Quarry / Source', String(job?.quarryName || '—')],
    ['Delivery Destination', String(job?.siteName || '—')],
  ];

  const documents: DocumentDefinition[] = [
    {
      kind: 'delivery',
      title: 'Delivery Note',
      identifier: jobId || 'Pending',
      icon: 'document-text-outline',
      color: '#2563EB',
      rows: [['Delivery Note #', jobId || '—'], ...baseRows.slice(1), ['Status', String(job?.status || 'Pending')]],
      available: Boolean(jobId),
      unavailableMessage: 'The job reference is not available yet.',
    },
    {
      kind: 'receipt',
      title: 'Receipt Note',
      identifier: receiptNoteId,
      icon: 'receipt-outline',
      color: '#059669',
      rows: [
        ['Receipt Note #', receiptNoteId],
        ...baseRows,
        ['Delivered Quantity', `${job?.quantityDelivered || job?.siteNetWeight || '—'} ${job?.unit || ''}`.trim()],
        ['Received At', String(job?.receivedAt || job?.completionTime || '—')],
      ],
      available: receiptAvailable,
      unavailableMessage: 'The receipt note will be available once the delivery is received.',
    },
    {
      kind: 'purchaseOrder',
      title: 'Purchase Order',
      identifier: String(job?.poNumber || poId || 'Pending'),
      icon: 'briefcase-outline',
      color: '#7C3AED',
      rows: [
        ['Purchase Order #', String(job?.poNumber || poId || '—')],
        ['Vendor', String(job?.vendorName || job?.companyName || '—')],
        ['Material', String(job?.materialName || '—')],
        ['Quantity', `${job?.quantityOrdered || job?.quantityDispatched || '—'} ${job?.unit || ''}`.trim()],
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
    router.push(`/screens/purchase-order?id=${encodeURIComponent(poId)}` as any);
  }

  async function exportDocument(document: DocumentDefinition, format: 'csv' | 'pdf') {
    if (!document.available) return;
    const key = `${document.kind}-${format}`;
    setExporting(key);
    try {
      const title = `${document.title} ${document.identifier}`;
      if (format === 'csv') {
        await shareCsvAsFile(title, buildCsvContent(['Field', 'Value'], document.rows));
      } else {
        await sharePdfAsFile(title, buildHtmlContent(['Field', 'Value'], document.rows, title));
      }
    } finally {
      setExporting(null);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Job Documents</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Tap a document to open it.</Text>
      {documents.filter((document) => document.kind !== 'receipt' || showReceiptNote).map((document) => {
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
                <Ionicons name={document.icon} size={22} color={document.color} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{document.title}</Text>
                <Text style={[styles.cardIdentifier, { color: document.available ? document.color : colors.textMuted }]} numberOfLines={1}>{document.identifier}</Text>
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
  section: { marginTop: Spacing.lg, gap: Spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionSubtitle: { fontSize: 13, marginBottom: Spacing.xs },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  cardDisabled: { opacity: 0.65 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardIdentifier: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  unavailable: { fontSize: 12, lineHeight: 17 },
  actions: { alignItems: 'flex-end' },
});
