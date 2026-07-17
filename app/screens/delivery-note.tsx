import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDeliveryOrders, fetchCheckpoints } from '../../services/api';
import { formatEAT } from '../../utils/helpers';
import { buildCsvContent, shareCsvAsFile } from '../../utils/exportData';
import { reverseGeocodeRich } from '../../services/geolocation';

const NAVY = '#1B2A4A';

/* ---------- Helper: escape HTML ---------- */
const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
};

/* ---------- HTML builder (same as before, but now all data escaped) ---------- */
function buildDeliveryNoteHtml(data: {
  jobId: string;
  poNumber: string;
  driverName: string;
  plateNumber: string;
  vendorName: string;
  materialName: string;
  quarryName: string;
  quarryCityTown?: string;
  quarryPersonnel?: string;
  siteName: string;
  netWeight?: string;
  weighInWeight?: string;
  weighOutWeight?: string;
  weighOutGeoAddress?: string;
  weighOutCity?: string;
  weighOutTown?: string;
  timestamp: string;
}): string {
  const {
    jobId, poNumber, driverName, plateNumber, vendorName,
    materialName, quarryName, quarryCityTown, quarryPersonnel,
    siteName, netWeight, weighInWeight, weighOutWeight,
    weighOutGeoAddress, weighOutCity, weighOutTown, timestamp,
  } = data;

  const e = escapeHtml;
  const geoLines = [weighOutGeoAddress, weighOutCity, weighOutTown].filter(Boolean);
  const geoText = geoLines.length > 0 ? geoLines.join(', ') : 'N/A';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1E293B; max-width: 600px; margin: auto; }
    .header { text-align: center; border-bottom: 3px solid #1B2A4A; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { color: #1B2A4A; font-size: 20px; margin-bottom: 4px; }
    .header .subtitle { color: #64748B; font-size: 13px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8; margin-bottom: 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .row .label { color: #64748B; }
    .row .value { font-weight: 700; color: #1E293B; }
    .highlight-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
    .highlight-box .net { font-size: 32px; font-weight: 900; color: #16A34A; }
    .highlight-box .calc { font-size: 11px; color: #64748B; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    table th { background: #1B2A4A; color: #FFF; padding: 8px 12px; text-align: left; font-weight: 700; border: 1px solid #DDD; }
    table td { padding: 8px 12px; border: 1px solid #DDD; }
    table tr:nth-child(even) td { background: #F8FAFC; }
    .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; color: #94A3B8; font-size: 10px; }
    .signature-line { display: flex; justify-content: space-between; margin-top: 48px; }
    .sig-block { flex: 1; text-align: center; }
    .sig-block .line { border-bottom: 1px solid #94A3B8; margin: 32px 20px 8px; }
    .sig-block .name { font-size: 12px; font-weight: 600; color: #1E293B; }
    .sig-block .role { font-size: 10px; color: #94A3B8; }
    @page { size: auto; margin: 20mm 15mm; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Trucks Sphere</h1>
    <div class="subtitle">Delivery Note / Waybill</div>
  </div>

  <div class="section">
    <div class="section-title">Document Details</div>
    <div class="row"><span class="label">Delivery Note #</span><span class="value">${e(jobId)}</span></div>
    <div class="row"><span class="label">Purchase Order</span><span class="value">${e(poNumber) || 'N/A'}</span></div>
    <div class="row"><span class="label">Date Created</span><span class="value">${e(timestamp)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Parties</div>
    <div class="row"><span class="label">Vendor</span><span class="value">${e(vendorName) || 'N/A'}</span></div>
    <div class="row"><span class="label">Driver</span><span class="value">${e(driverName) || 'N/A'}</span></div>
    <div class="row"><span class="label">Truck</span><span class="value">${e(plateNumber) || 'N/A'}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Material</div>
    <div class="row"><span class="label">Material</span><span class="value">${e(materialName) || 'N/A'}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Route & Geolocation</div>
 
    <div class="row"><span class="label">City / Town</span><span class="value">${e(quarryCityTown) || e(weighOutCity) || 'N/A'}</span></div>
    <div class="row"><span class="label">Weigh-Out Location</span><span class="value">${e(geoText)}</span></div>
    <div class="row"><span class="label">Destination (Site)</span><span class="value">${e(siteName) || 'N/A'}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Quarry Personnel</div>
    <div class="row"><span class="label">Recorded By</span><span class="value">${e(quarryPersonnel) || 'N/A'}</span></div>
  </div>

  ${weighInWeight || weighOutWeight || netWeight ? `
  <div class="section">
    <div class="section-title">Weight Record</div>
    <table>
      <tr><td>Weigh-In (Gross)</td><td style="font-weight:700;">${e(weighInWeight) || '—'}</td></tr>
      <tr><td>Weigh-Out (Tare)</td><td style="font-weight:700;">${e(weighOutWeight) || '—'}</td></tr>
    </table>
    ${netWeight ? `
    <div class="highlight-box">
      <div class="net">${e(netWeight)} tonnes</div>
      <div class="calc">NET WEIGHT</div>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="signature-line">
    <div class="sig-block">
      <div class="line"></div>
      <div class="name">${e(quarryPersonnel) || 'Quarry Operator'}</div>
      <div class="role">Quarry Personnel</div>
    </div>
    <div class="sig-block">
      <div class="line"></div>
      <div class="name">${e(driverName) || 'Driver'}</div>
      <div class="role">Driver</div>
    </div>
  </div>

  <div class="footer">
    <p>Generated by Trucks Sphere on ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}</p>
    <p>This is a computer-generated document.</p>
  </div>
</body>
</html>`;
}

/* ---------- Web-specific print using hidden iframe ---------- */
const printHtmlOnWeb = (html: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      // Write HTML into the iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        reject(new Error('Unable to access iframe document'));
        return;
      }
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Wait for images and styles to load, then print
      iframe.onload = () => {
        iframe.contentWindow?.print();
        // Remove iframe after printing (or after a delay)
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve();
        }, 1000);
      };

      // If onload doesn't fire, fallback after a timeout
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            resolve();
          }, 1000);
        }
      }, 500);
    } catch (error) {
      reject(error);
    }
  });
};

/* ---------- Main Screen ---------- */
export default function DeliveryNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [searchJobId, setSearchJobId] = useState(id || '');
  const [delivery, setDelivery] = useState<any>(null);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [geoCity, setGeoCity] = useState<string | undefined>();
  const [geoTown, setGeoTown] = useState<string | undefined>();
  const [geoAddress, setGeoAddress] = useState<string | undefined>();

  const loadData = async (jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    setError('');
    try {
      const deliveries = await fetchDeliveryOrders({ jobId });
      if (!deliveries || deliveries.length === 0) {
        setError(`No delivery found for: ${jobId}`);
        setDelivery(null);
        setCheckpoints([]);
        setLoading(false);
        return;
      }
      const d = deliveries[0];
      setDelivery(d);

      if (d.weighOutLatitude != null && d.weighOutLongitude != null) {
        reverseGeocodeRich(d.weighOutLatitude, d.weighOutLongitude).then((geo) => {
          setGeoAddress(geo.address);
          setGeoCity(geo.city);
          setGeoTown(geo.town || geo.name);
        }).catch(() => {});
      }

      const cps = await fetchCheckpoints({ jobId });
      setCheckpoints(cps || []);
    } catch (e: any) {
      setError('Failed to load delivery data');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) { setSearchJobId(id); loadData(id); } else { setLoading(false); }
  }, [id]);

  const handleSearch = () => { loadData(searchJobId.trim()); };

  const netWeight = delivery?.netWeight || (delivery?.weighInWeight && delivery?.weighOutWeight ? (delivery.weighInWeight - delivery.weighOutWeight).toFixed(1) : null);
  const quarryCityTown = geoCity || geoTown || delivery?.weighOutGeoLocation?.address || delivery?.weighOutLocation || null;
  const quarryPersonnel = delivery?.operatorUsername || delivery?.weighOutByName || delivery?.quarryOperatorName || delivery?.weighOutBy || delivery?.weighOutOperator || null;

  const exportHeaders = ['Field', 'Value'];
  const getExportRows = () => {
    if (!delivery) return [];
    return [
      ['Delivery Note #', delivery.jobId],
      ['Purchase Order', delivery.poNumber || 'N/A'],
      ['Vendor', delivery.vendorName || 'N/A'],
      ['Driver', delivery.driverName || 'N/A'],
      ['Truck', delivery.plateNumber || 'N/A'],
      ['Material', delivery.materialName || 'N/A'],
     ['Recorded By', quarryPersonnel || 'N/A'],
      ['City / Town', quarryCityTown || 'N/A'],
      ['Quarry Personnel', quarryPersonnel || 'N/A'],
      ['Geolocation (Weigh-Out)', geoAddress || 'N/A'],
      ['Destination', delivery.siteName || 'N/A'],
      ['Weigh-In', delivery.weighInWeight ? `${delivery.weighInWeight} t` : '—'],
      ['Weigh-Out', delivery.weighOutWeight ? `${delivery.weighOutWeight} t` : '—'],
      ['Net Weight', `${netWeight} tonnes`],
      ['Status', (delivery.status || '').replace(/_/g, ' ').toUpperCase()],
      ['Date Created', delivery.createdAt || ''],
    ];
  };

  const handleDownloadCSV = async () => {
    if (!delivery) return;
    setExporting('csv');
    try {
      const csvContent = buildCsvContent(exportHeaders, getExportRows());
      await shareCsvAsFile(`Delivery_Note_${delivery.jobId}`, csvContent);
    } catch {} finally {
      setExporting(null);
    }
  };

  const handlePrintPDF = async () => {
    if (!delivery) return;
    setExporting('pdf');
    try {
      const pdfData = {
        jobId: delivery.jobId || '',
        poNumber: delivery.poNumber || '',
        driverName: delivery.driverName || '',
        plateNumber: delivery.plateNumber || '',
        vendorName: delivery.vendorName || '',
        materialName: delivery.materialName || '',
        quarryName: delivery.quarryName || '',
        quarryCityTown: quarryCityTown || '',
        quarryPersonnel: quarryPersonnel || '',
        siteName: delivery.siteName || '',
        netWeight: netWeight ? `${netWeight}` : '',
        weighInWeight: delivery.weighInWeight ? `${delivery.weighInWeight} t` : '',
        weighOutWeight: delivery.weighOutWeight ? `${delivery.weighOutWeight} t` : '',
        weighOutGeoAddress: geoAddress || '',
        weighOutCity: geoCity || '',
        weighOutTown: geoTown || '',
        timestamp: formatEAT(delivery.createdAt) || new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
      };
      const html = buildDeliveryNoteHtml(pdfData);

      if (Platform.OS === 'web') {
        // Use hidden iframe method to reliably print HTML
        await printHtmlOnWeb(html);
      } else {
        // Native: generate PDF file then print it
        const { uri } = await Print.printToFileAsync({ html });
        await Print.printAsync({ uri });
      }
    } catch (error: any) {
      console.error('PDF generation/print error:', error);
      Alert.alert('Print Error', error?.message || 'Could not generate PDF. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {!id && (
        <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Enter Delivery Note number..."
            placeholderTextColor={colors.textMuted}
            value={searchJobId}
            onChangeText={setSearchJobId}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={handleSearch}>
            <Ionicons name="arrow-forward-circle" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading delivery data...</Text>
        </View>
      )}

      {Boolean(error) && !loading && (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      )}

      {!loading && delivery && (
        <>
          <View style={[styles.receipt, { backgroundColor: '#FFFDF7', borderColor: '#E5E0D0' }]}>
            <View style={styles.receiptHeader}>
              <Ionicons name="document-text" size={28} color="#333" />
              <Text style={styles.receiptTitle}>DELIVERY NOTE</Text>
              <Text style={styles.receiptSubtitle}>Job Card / Waybill</Text>
              <View style={[styles.line, { backgroundColor: '#DDD' }]} />
            </View>
            <View style={{ padding: Spacing.sm }}>
              <Text style={styles.rHead}>{delivery.siteName}</Text>
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
              <DNRow label="Delivery Note #" value={delivery.jobId} bold />
              <DNRow label="Purchase Order" value={delivery.poNumber} />
              <DNRow label="Date Created" value={formatEAT(delivery.createdAt)} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
              <Text style={styles.rSection}>PARTIES</Text>
              <DNRow label="Vendor" value={delivery.vendorName} />
              <DNRow label="Driver" value={delivery.driverName} />
              <DNRow label="Truck" value={delivery.plateNumber} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
              <Text style={styles.rSection}>MATERIAL</Text>
              <DNRow label="Material" value={delivery.materialName} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
              <Text style={styles.rSection}>ROUTE </Text>
              
              {geoAddress ? <DNRow label="Weigh-Out Location" value={geoAddress} /> : null}
              <DNRow label="Destination" value={delivery.siteName} />
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
              {quarryPersonnel ? (
                <>
                  <Text style={styles.rSection}>QUARRY PERSONNEL</Text>
                  <DNRow label="Recorded By" value={quarryPersonnel} bold />
                  <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
                </>
              ) : null}
              {netWeight !== null && (
                <>
                  <Text style={styles.rSection}>WEIGHTS</Text>
                  <DNRow label="Quarry Weigh-In" value={delivery.weighInWeight ? `${delivery.weighInWeight} t` : '—'} />
                  <DNRow label="Quarry Weigh-Out" value={delivery.weighOutWeight ? `${delivery.weighOutWeight} t` : '—'} />
                  <DNRow label=" Quarry Net Weight" value={`${netWeight} tonnes`} bold />
                  <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
                </>
              )}
              <Text style={styles.rBarcode}>||| ||| ||| ||| ||| ||| |||</Text>
              <Text style={styles.rFooter}>Quarry Operator Confirmation</Text>
              <Text style={styles.rThanks}>Thank you</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
              onPress={handleDownloadCSV}
              disabled={exporting !== null}
            >
              {exporting === 'csv' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.actionBtnText}>Download CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: NAVY }]}
              onPress={handlePrintPDF}
              disabled={exporting !== null}
            >
              {exporting === 'pdf' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="print-outline" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.actionBtnText}>Print PDF</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {!loading && !delivery && !error && (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>Enter a Delivery Note number above</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ---------- Reusable receipt row ---------- */
const DNRow = ({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) => (
  <View style={dnStyles.row}>
    <Text style={dnStyles.label}>{label}</Text>
    <Text style={[dnStyles.value, bold && { fontWeight: '700' }]} numberOfLines={3}>{value}</Text>
  </View>
);

const dnStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 3, gap: 8 },
  label: { fontSize: 14, color: '#666', flexShrink: 0, marginTop: 1 },
  value: { fontSize: 14, color: '#333', flex: 1, textAlign: 'right', flexWrap: 'wrap' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing['4xl'], gap: Spacing.sm },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 46, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: 14 },
  center: { alignItems: 'center', paddingVertical: Spacing['4xl'], gap: Spacing.sm },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center' },
  receipt: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.lg },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptTitle: { fontSize: 16, fontWeight: '700', color: '#333', letterSpacing: 1, marginTop: 4 },
  receiptSubtitle: { fontSize: 14, color: '#999', marginTop: 2 },
  line: { width: '80%', height: 1, marginTop: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  rDash: { textAlign: 'center', color: '#CCC', marginVertical: 4, fontSize: 11 },
  rSection: { fontSize: 14, fontWeight: '700', color: '#999', letterSpacing: 1, marginTop: 4, marginBottom: 2 },
  rBarcode: { textAlign: 'center', fontSize: 14, color: '#333', letterSpacing: 2, marginTop: 8 },
  rFooter: { textAlign: 'center', fontSize: 14, color: '#999', marginTop: 2 },
  rThanks: { textAlign: 'center', fontSize: 14, color: '#666', marginTop: 4, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});