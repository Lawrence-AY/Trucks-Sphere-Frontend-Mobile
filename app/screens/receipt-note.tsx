import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT, generateReceiptNoteId } from '../../utils/helpers';
import { buildCsvContent, shareCsvAsFile } from '../../utils/exportData';
import { reverseGeocode, reverseGeocodeRich } from '../../services/geolocation';

/* ─────────── Helper: escape HTML special characters ─────────── */
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

/* ─────────── Web‑specific print using hidden iframe ─────────── */
const printHtmlOnWeb = (html: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        reject(new Error('Unable to access iframe document'));
        return;
      }
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          resolve();
        }, 1000);
      };

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
            resolve();
          }, 1000);
        }
      }, 500);
    } catch (error) {
      reject(error);
    }
  });
};

/* ─────────── Receipt Note PDF HTML Builder (with escaping) ─────────── */
function buildReceiptNoteHtml(data: {
  receiptNoteId: string;
  jobId: string;
  poNumber: string;
  driverName: string;
  plateNumber: string;
  vendorName: string;
  materialName: string;
  quarryName: string;
  quarryCityTown?: string;
  quarryPersonnel?: string;
  quarryWeighIn?: string;
  quarryWeighOut?: string;
  quarryNetWeight?: string;
  siteName: string;
  siteWeighIn?: string;
  siteWeighOut?: string;
  siteNetWeight?: string;
  weighOutGeoAddress?: string;
  timestamp: string;
  operatorName: string;
}): string {
  const {
    receiptNoteId, jobId, poNumber, driverName, plateNumber,
    vendorName, materialName, quarryName, quarryCityTown,
    quarryPersonnel, quarryWeighIn, quarryWeighOut, quarryNetWeight,
    siteName, siteWeighIn, siteWeighOut, siteNetWeight,
    weighOutGeoAddress, timestamp, operatorName,
  } = data;

  const e = escapeHtml;
  const hasQuarryWeights = quarryWeighIn || quarryWeighOut || quarryNetWeight;
  const hasSiteWeights = siteWeighIn || siteWeighOut || siteNetWeight;

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
    <div class="subtitle">Goods Receipt Note (GRN)</div>
  </div>

  <div class="section">
    <div class="section-title">Document Details</div>
    <div class="row"><span class="label">Receipt Note</span><span class="value">${e(receiptNoteId) || e(jobId)}</span></div>
    <div class="row"><span class="label">Job ID</span><span class="value">${e(jobId)}</span></div>
    <div class="row"><span class="label">Purchase Order</span><span class="value">${e(poNumber) || 'N/A'}</span></div>
    <div class="row"><span class="label">Date</span><span class="value">${e(timestamp)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Parties</div>
    <div class="row"><span class="label">Vendor</span><span class="value">${e(vendorName) || 'N/A'}</span></div>
    <div class="row"><span class="label">Driver</span><span class="value">${e(driverName) || 'N/A'}</span></div>
    <div class="row"><span class="label">Truck Plate</span><span class="value">${e(plateNumber) || 'N/A'}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Material</div>
    <div class="row"><span class="label">Material</span><span class="value">${e(materialName) || 'N/A'}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Route </div>
    <div class="row"><span class="label">Origin (Quarry)</span><span class="value">${e(quarryName) || 'N/A'}</span></div>
    <div class="row"><span class="label">City / Town</span><span class="value">${e(quarryCityTown) || 'N/A'}</span></div>
    ${weighOutGeoAddress ? `<div class="row"><span class="label">Weigh-Out Location</span><span class="value">${e(weighOutGeoAddress)}</span></div>` : ''}
    <div class="row"><span class="label">Destination (Site)</span><span class="value">${e(siteName) || 'N/A'}</span></div>
  </div>

  ${quarryPersonnel ? `
  <div class="section">
    <div class="section-title">Quarry Personnel</div>
    <div class="row"><span class="label">Recorded By</span><span class="value">${e(quarryPersonnel)}</span></div>
  </div>
  ` : ''}

  ${hasQuarryWeights ? `
  <div class="section">
    <div class="section-title">Quarry Weight Record (Reference)</div>
    <table>
      <tr><td>Quarry Weigh-In (Gross)</td><td style="font-weight:700;">${e(quarryWeighIn) || '—'}</td></tr>
      <tr><td>Quarry Weigh-Out (Tare)</td><td style="font-weight:700;">${e(quarryWeighOut) || '—'}</td></tr>
      ${quarryNetWeight ? `<tr><td>Quarry Net Weight</td><td style="font-weight:700; color:#16A34A;">${e(quarryNetWeight)}</td></tr>` : ''}
    </table>
  </div>
  ` : ''}

  ${hasSiteWeights ? `
  <div class="section">
    <div class="section-title">Site Weight Record</div>
    <table>
      <tr><td>Site Arrival Weight (Gross)</td><td style="font-weight:700;">${e(siteWeighIn) || '—'}</td></tr>
      <tr><td>Post-Offload Weight (Tare)</td><td style="font-weight:700;">${e(siteWeighOut) || '—'}</td></tr>
    </table>
    ${siteNetWeight ? `
    <div class="highlight-box">
      <div class="net">${e(siteNetWeight)}</div>
      <div class="calc">NET WEIGHT</div>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Certification</div>
    <div class="row"><span class="label">Operator</span><span class="value">${e(operatorName)}</span></div>
    <div class="row"><span class="label">Location</span><span class="value">${e(siteName) || 'Site'}</span></div>
  </div>

  <div class="signature-line">
    <div class="sig-block">
      <div class="line"></div>
      <div class="name">${e(operatorName)}</div>
      <div class="role">Site Operator</div>
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

/* ─────────── Main Screen ─────────── */

export default function ReceiptNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<any>(null);
  const [resolvedQuarryName, setResolvedQuarryName] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [geoCity, setGeoCity] = useState<string | undefined>();
  const [geoTown, setGeoTown] = useState<string | undefined>();
  const [geoAddress, setGeoAddress] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      try {
        const orders = await fetchDeliveryOrders({ jobId: id });
        if (orders && orders.length > 0) {
          const d = orders[0];
          setDelivery({
            ...d,
            receiptNoteId: d.receiptNoteId || generateReceiptNoteId(),
          });

          if (d.quarryLatitude != null && d.quarryLongitude != null) {
            reverseGeocode(d.quarryLatitude, d.quarryLongitude).then((name) => {
              setResolvedQuarryName(name);
            }).catch(() => {});
          } else if (d.quarryLat != null && d.quarryLng != null) {
            reverseGeocode(d.quarryLat, d.quarryLng).then((name) => {
              setResolvedQuarryName(name);
            }).catch(() => {});
          }

          if (d.weighOutLatitude != null && d.weighOutLongitude != null) {
            reverseGeocodeRich(d.weighOutLatitude, d.weighOutLongitude).then((geo) => {
              setGeoAddress(geo.address);
              setGeoCity(geo.city);
              setGeoTown(geo.town || geo.name);
            }).catch(() => {});
          }
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted, marginTop: 12 }}>Loading receipt note...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
        <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 16 }}>Receipt note not found</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rn = delivery.receiptNoteId;
  const jobId = delivery.jobId;
  const poNumber = delivery.poNumber || 'N/A';
  const driverName = delivery.driverName || 'N/A';
  const plateNumber = delivery.plateNumber || 'N/A';
  const vendorName = delivery.vendorName || 'N/A';
  const vendorId = delivery.vendorId || '';
  const materialName = delivery.materialName || 'N/A';
  const quarryName = resolvedQuarryName || delivery.quarryName || 'N/A';
  const quarryCityTown = geoCity || geoTown || delivery?.weighOutGeoLocation?.address || delivery?.weighOutLocation || null;
  const quarryPersonnel = delivery?.operatorUsername || delivery?.weighOutByName || delivery?.quarryOperatorName || delivery?.weighOutBy || delivery?.weighOutOperator || null;
  const siteName = delivery.siteName || 'N/A';
  const siteWeighIn = delivery.siteWeighInWeight ?? null;
  const siteWeighOut = delivery.siteWeighOutWeight ?? null;
  const siteNet = delivery.siteNetWeight ?? delivery.quantityDelivered ?? null;
  const quarryWeighIn = delivery.weighInWeight ?? null;
  const quarryWeighOut = delivery.weighOutWeight ?? null;
  const quarryNet = delivery.netWeight ?? null;

  // Export helpers
  const exportHeaders = ['Field', 'Value'];
const exportRows = [
  ['Receipt Note', rn],
  ['Job ID', jobId],
  ['Purchase Order', poNumber],
  ['Driver', driverName],
  ['Truck', plateNumber],
  ['Vendor', vendorName],
  ['Material', materialName],
   
  ['City / Town', quarryCityTown || 'N/A'],
  ['Quarry Personnel', quarryPersonnel || 'N/A'],
  ['Weigh-Out Location', geoAddress || 'N/A'],
  ['Destination', siteName],
  ['Quarry Weigh-In (Gross)', quarryWeighIn != null ? `${quarryWeighIn.toFixed(1)} T` : 'N/A'],
  ['Quarry Weigh-Out (Tare)', quarryWeighOut != null ? `${quarryWeighOut.toFixed(1)} T` : 'N/A'],
  ['Quarry Net Weight', quarryNet != null ? `${quarryNet.toFixed(1)} T` : 'N/A'],
  ['Site Arrival (Gross)', siteWeighIn != null ? `${siteWeighIn.toFixed(1)} T` : 'N/A'],
  ['Site Weigh Out (Tare)', siteWeighOut != null ? `${siteWeighOut.toFixed(1)} T` : 'N/A'],
  ['Site Net Weight', siteNet != null ? `${siteNet.toFixed(1)} T` : 'N/A'],
  ['Site Operator', delivery.receivedBy || 'N/A'],   // <── NEW ROW
  ['Finalized', formatEAT(delivery.receivedAt || delivery.updatedAt)],
];

  const handleDownloadCSV = async () => {
    setExporting('csv');
    try {
      const csvContent = buildCsvContent(exportHeaders, exportRows);
      await shareCsvAsFile(`Receipt_Note_${rn}`, csvContent);
    } catch {} finally {
      setExporting(null);
    }
  };

  const handlePrintPDF = async () => {
    setExporting('pdf');
    try {
      const html = buildReceiptNoteHtml({
        receiptNoteId: rn,
        jobId,
        poNumber,
        driverName,
        plateNumber,
        vendorName,
        materialName,
        quarryName,
        quarryCityTown: quarryCityTown || undefined,
        quarryPersonnel: quarryPersonnel || undefined,
        quarryWeighIn: quarryWeighIn != null ? `${quarryWeighIn.toFixed(1)} T` : undefined,
        quarryWeighOut: quarryWeighOut != null ? `${quarryWeighOut.toFixed(1)} T` : undefined,
        quarryNetWeight: quarryNet != null ? `${quarryNet.toFixed(1)} T` : undefined,
        siteName,
        siteWeighIn: siteWeighIn != null ? `${siteWeighIn.toFixed(1)} T` : undefined,
        siteWeighOut: siteWeighOut != null ? `${siteWeighOut.toFixed(1)} T` : undefined,
        siteNetWeight: siteNet != null ? `${siteNet.toFixed(1)} T` : undefined,
        weighOutGeoAddress: geoAddress,
        timestamp: formatEAT(delivery.receivedAt || delivery.updatedAt),
        operatorName: delivery.receivedBy || 'Site Operator',
      });

      if (Platform.OS === 'web') {
        await printHtmlOnWeb(html);
      } else {
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
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Receipt Note Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.rnIconWrap, { backgroundColor: '#10B98115' }]}>
            <Ionicons name="receipt" size={32} color="#10B981" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.rnTitle, { color: '#10B981' }]} numberOfLines={4}>{rn}</Text>
            <Text style={[styles.rnSubtitle, { color: colors.textMuted }]}>
              Receipt Note
            </Text>
          </View>
        </View>

        {/* Job Info */}
        <SectionBlock title="DOCUMENT DETAILS" colors={colors}>
          <RNRow label="Job ID" value={jobId} colors={colors} />
          <RNRow label="Purchase Order" value={poNumber} colors={colors} />
          <RNRow
            label="Finalized"
            value={formatEAT(delivery.receivedAt || delivery.updatedAt)}
            colors={colors}
          />
        </SectionBlock>

        {/* Parties */}
        <SectionBlock title="PARTIES" colors={colors}>
          <RNRow label="Driver" value={driverName} colors={colors} />
          <RNRow label="Truck" value={plateNumber} colors={colors} />
          <RNRow
            label="Vendor"
            value={vendorName}
            colors={colors}
            tappable={!!vendorId}
            onPress={() => vendorId && router.push(`/screens/vendor-detail?id=${vendorId}` as any)}
          />
        </SectionBlock>

        {/* Route & Geolocation */}
        <SectionBlock title="ROUTE " colors={colors}>
          <RNRow label="Origin" value={quarryName} colors={colors} />
          {quarryCityTown ? (
            <RNRow label="City / Town" value={quarryCityTown} colors={colors} />
          ) : null}
          {geoAddress ? (
            <RNRow label="Weigh-Out Location" value={geoAddress} colors={colors} />
          ) : null}
          <RNRow label="Destination" value={siteName} colors={colors} />
          <RNRow label="Material" value={materialName} colors={colors} />
        </SectionBlock>

        {/* Quarry Personnel */}
        {quarryPersonnel ? (
          <SectionBlock title="QUARRY PERSONNEL" colors={colors}>
            <RNRow label="Recorded By" value={quarryPersonnel} colors={colors} bold />
          </SectionBlock>
        ) : null}

        {/* Quarry Weight Record */}
        {(quarryWeighIn != null || quarryWeighOut != null || quarryNet != null) ? (
          <SectionBlock title="QUARRY WEIGHT RECORD (REFERENCE)" colors={colors}>
            <RNRow
              label="Quarry Weigh-In (Gross)"
              value={quarryWeighIn != null ? `${quarryWeighIn.toFixed(1)} T` : 'N/A'}
              colors={colors}
              valueColor="#7C3AED"
            />
            <RNRow
              label="Quarry Weigh-Out (Tare)"
              value={quarryWeighOut != null ? `${quarryWeighOut.toFixed(1)} T` : 'N/A'}
              colors={colors}
              valueColor="#7C3AED"
            />
            {quarryNet != null && (
              <RNRow
                label="Quarry Net Weight"
                value={`${quarryNet.toFixed(1)} T`}
                colors={colors}
                valueColor="#2563EB"
              />
            )}
          </SectionBlock>
        ) : null}

        {/* Site Weight Record */}
        <SectionBlock title="SITE WEIGHT RECORD" colors={colors}>
          <RNRow
            label="Site Arrival (Gross)"
            value={siteWeighIn != null ? `${siteWeighIn.toFixed(1)} T` : 'N/A'}
            colors={colors}
            valueColor="#F59E0B"
          />
          <RNRow
            label="Site Weigh Out (Tare)"
            value={siteWeighOut != null ? `${siteWeighOut.toFixed(1)} T` : 'N/A'}
            colors={colors}
            valueColor="#8B5CF6"
          />
          <View style={styles.netDivider} />
          <RNRow
            label="Site Net Weight"
            value={siteNet != null ? `${siteNet.toFixed(1)} T` : 'N/A'}
            colors={colors}
            valueColor="#10B981"
            bold
          />
          {quarryNet != null && (
            <RNRow
              label="Quarry Net (Reference)"
              value={`${quarryNet.toFixed(1)} T`}
              colors={colors}
              valueColor="#2563EB"
            />
          )}
        </SectionBlock>
      </View>

      {/* Actions — CSV + Print PDF */}
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
          style={[styles.actionBtn, { backgroundColor: '#1B2A4A' }]}
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
    </ScrollView>
  );
}

const SectionBlock = ({ title, colors, children }: { title: string; colors: any; children: React.ReactNode }) => (
  <View style={[styles.section, { borderColor: colors.border }]}>
    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
    {children}
  </View>
);

const RNRow = ({
  label,
  value,
  colors,
  valueColor,
  bold,
  tappable,
  onPress,
}: {
  label: string;
  value: string;
  colors: any;
  valueColor?: string;
  bold?: boolean;
  tappable?: boolean;
  onPress?: () => void;
}) => (
  <View style={styles.rnRow}>
    <Text style={[styles.rnLabel, { color: colors.textMuted }]}>{label}</Text>
    {tappable ? (
      <TouchableOpacity onPress={onPress} style={{ flex: 1 }}>
        <Text
          style={[
            styles.rnValue,
            { color: valueColor || colors.primary, fontWeight: bold ? '800' : '600', textDecorationLine: 'underline' },
          ]}
          numberOfLines={3}
        >
          {value}
        </Text>
      </TouchableOpacity>
    ) : (
      <Text
        style={[
          styles.rnValue,
          { color: valueColor || colors.text, fontWeight: bold ? '800' : '600' },
        ]}
        numberOfLines={3}
      >
        {value}
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  backBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md },
  card: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  rnIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rnTitle: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  rnSubtitle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  section: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 3,
    gap: Spacing.sm,
  },
  rnLabel: { fontSize: 13, flexShrink: 0, marginTop: 1 },
  rnValue: { fontSize: 13, flex: 1, textAlign: 'right', flexWrap: 'wrap' },
  netDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
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