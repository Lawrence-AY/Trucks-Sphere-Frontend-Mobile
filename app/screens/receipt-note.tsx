import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Radius, Spacing } from '../../constants/theme';
import { fetchDeliveryOrders } from '../../services/api';
import { formatEAT, generateReceiptNoteId } from '../../utils/helpers';
import { buildCsvContent, shareCsvAsFile, buildHtmlContent, sharePdfAsFile } from '../../utils/exportData';
import { reverseGeocode } from '../../services/geolocation';

export default function ReceiptNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<any>(null);
  const [resolvedQuarryName, setResolvedQuarryName] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

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

          // Resolve quarry name from coordinates if available
          if (d.quarryLatitude != null && d.quarryLongitude != null) {
            reverseGeocode(d.quarryLatitude, d.quarryLongitude).then((name) => {
              setResolvedQuarryName(name);
            }).catch(() => {});
          } else if (d.quarryLat != null && d.quarryLng != null) {
            reverseGeocode(d.quarryLat, d.quarryLng).then((name) => {
              setResolvedQuarryName(name);
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
  const quantityOrdered = delivery.quantityOrdered || 0;
  const quarryName = resolvedQuarryName || delivery.quarryName || 'N/A';
  const quarryCityTown = delivery.weighOutGeoLocation?.address || delivery.weighOutLocation || null;
  const siteName = delivery.siteName || 'N/A';
  const siteWeighIn = delivery.siteWeighInWeight ?? null;
  const siteWeighOut = delivery.siteWeighOutWeight ?? null;
  const siteNet = delivery.siteNetWeight ?? delivery.quantityDelivered ?? null;
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
    ['Ordered Qty', `${quantityOrdered} tonnes`],
    ['Origin', quarryName],
    ['Destination', siteName],
    ['Site Arrival (Gross)', siteWeighIn != null ? `${siteWeighIn.toFixed(1)} T` : 'N/A'],
    ['Site Weigh Out (Tare)', siteWeighOut != null ? `${siteWeighOut.toFixed(1)} T` : 'N/A'],
    ['Site Net Weight', siteNet != null ? `${siteNet.toFixed(1)} T` : 'N/A'],
    ['Quarry Net (Reference)', quarryNet != null ? `${quarryNet.toFixed(1)} T` : 'N/A'],
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

  const handleDownloadPDF = async () => {
    setExporting('pdf');
    try {
      const htmlContent = buildHtmlContent(exportHeaders, exportRows, `Receipt Note - ${rn}`);
      await sharePdfAsFile(`Receipt_Note_${rn}`, htmlContent);
    } catch {} finally {
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

        {/* Route */}
        <SectionBlock title="ROUTE" colors={colors}>
          <RNRow label="Origin" value={quarryName} colors={colors} />
          {quarryCityTown ? (
            <RNRow label="City / Town" value={quarryCityTown} colors={colors} />
          ) : null}
          <RNRow label="Destination" value={siteName} colors={colors} />
          <RNRow label="Material" value={materialName} colors={colors} />
        </SectionBlock>

        {/* Weight Record */}
        <SectionBlock title="WEIGHT RECORD" colors={colors}>
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

      {/* Actions — Download CSV and PDF */}
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
          style={[styles.actionBtn, { backgroundColor: '#DC2626' }]}
          onPress={handleDownloadPDF}
          disabled={exporting !== null}
        >
          {exporting === 'pdf' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="document-outline" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.actionBtnText}>Download PDF</Text>
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
  diffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
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
  actionBtnTextAlt: { fontSize: 14, fontWeight: '600' },
});