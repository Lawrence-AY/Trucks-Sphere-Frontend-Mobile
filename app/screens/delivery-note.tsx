import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDeliveryOrders, fetchCheckpoints } from '../../services/api';
import { formatEAT, formatStatus, getStatusColor, JOURNEY_STEPS } from '../../utils/helpers';
import { buildCsvContent, shareCsvAsFile } from '../../utils/exportData';

const NAVY = '#1B2A4A';

export default function DeliveryNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [searchJobId, setSearchJobId] = useState(id || '');
  const [delivery, setDelivery] = useState<any>(null);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'csv' | null>(null);

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
      setDelivery(deliveries[0]);
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

  const sortedCheckpoints = [...checkpoints].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const completedTypes = new Set(sortedCheckpoints.map(cp => cp.type));
  const currentStepIdx = (() => {
    for (let i = JOURNEY_STEPS.length - 1; i >= 0; i--) {
      if (completedTypes.has(JOURNEY_STEPS[i].type)) return i;
    }
    return -1;
  })();

  const netWeight = delivery?.netWeight || (delivery?.weighInWeight && delivery?.weighOutWeight ? (delivery.weighInWeight - delivery.weighOutWeight).toFixed(1) : null);

  // Export helpers
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
      ['Ordered Qty', `${delivery.quantityOrdered || 0} tonnes`],
      ['Origin', delivery.quarryName || 'N/A'],
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
          {/* Receipt */}
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
              <Text style={styles.rSection}>ROUTE</Text>
              <DNRow label="Origin" value={delivery.quarryName} />
              {(delivery.weighOutGeoLocation?.address || delivery.weighOutLocation) ? (
                <DNRow label="City / Town" value={delivery.weighOutGeoLocation?.address || delivery.weighOutLocation} />
              ) : null}
              <DNRow label="Destination" value={delivery.siteName} />
              {netWeight !== null && (
                <>
                  <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
                  <Text style={styles.rSection}>WEIGHTS</Text>
                  <DNRow label="Weigh-In" value={delivery.weighInWeight ? `${delivery.weighInWeight} t` : '—'} />
                  <DNRow label="Weigh-Out" value={delivery.weighOutWeight ? `${delivery.weighOutWeight} t` : '—'} />
                  <DNRow label="Net Weight" value={`${netWeight} tonnes`} bold />
                </>
              )}
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
            
              <Text style={styles.rDash}>- - - - - - - - - - - - - - - - -</Text>
              <Text style={styles.rBarcode}>||| ||| ||| ||| ||| ||| |||</Text>
              <Text style={styles.rFooter}>Site Operator Confirmation</Text>
              <Text style={styles.rThanks}>Thank you</Text>
            </View>
          </View>

          {/* Download actions — CSV only */}
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
  stamp: { alignItems: 'center', paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginVertical: 8 },
  stampText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  statusBadge: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  rBarcode: { textAlign: 'center', fontSize: 14, color: '#333', letterSpacing: 2, marginTop: 8 },
  rFooter: { textAlign: 'center', fontSize: 14, color: '#999', marginTop: 2 },
  rThanks: { textAlign: 'center', fontSize: 14, color: '#666', marginTop: 4, fontStyle: 'italic' },
  sectTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.sm },
  timelineWrap: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  tRow: { flexDirection: 'row' },
  tLeft: { alignItems: 'center', width: 30, marginRight: Spacing.sm },
  tDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tLine: { width: 2, flex: 1, marginTop: 2, marginBottom: 2 },
  tContent: { flex: 1, borderRadius: Radius.sm, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm, borderColor: '#E2E8F0' },
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