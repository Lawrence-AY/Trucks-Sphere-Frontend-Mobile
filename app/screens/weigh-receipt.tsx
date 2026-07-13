import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

export default function WeighReceiptScreen() {
  const { id, weightIn, weightOut, driver, truck } = useLocalSearchParams<{
    id: string;
    weightIn?: string;
    weightOut?: string;
    driver?: string;
    truck?: string;
  }>();
  const colors = useTheme();

  const wIn = parseFloat(weightIn || '0');
  const wOut = parseFloat(weightOut || '0');
  const net = wIn - wOut;
  const isWeighOut = wOut > 0;

  const receiptData = {
    stationName: 'Athi River Quarry',
    stationCode: 'QRY-ATH-001',
    operator: 'Quarry Operator',
    truckPlate: truck || 'KAA 123B',
    driverName: driver || 'James Mwangi',
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    grossWeight: wIn,
    tareWeight: wOut,
    netWeight: net,
    remarks: isWeighOut ? 'COMPLETED - Net Weight Calculated' : 'WEIGHED IN - Awaiting Tare',
  };

  const handleShare = async () => {
    const msg = `TruckSphere Weigh Receipt #${id}
Station: ${receiptData.stationName}
Truck: ${receiptData.truckPlate} | Driver: ${receiptData.driverName}
Gross: ${wIn.toFixed(1)}T${isWeighOut ? ` | Tare: ${wOut.toFixed(1)}T | Net: ${net.toFixed(1)}T` : ''}
Status: ${receiptData.remarks}`;
    await Share.share({ message: msg, title: 'Weigh Receipt' });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Supermarket-style thermal receipt */}
      <View style={[styles.receipt, { backgroundColor: '#FFFDF7', borderColor: '#E5E0D0' }]}>
        {/* Header */}
        <View style={styles.receiptHeader}>
          <Ionicons name="scale" size={32} color="#333" />
          <Text style={styles.receiptTitle}>WEIGHBRIDGE TICKET</Text>
          <View style={styles.receiptLine} />
        </View>

        {/* Body */}
        <View style={styles.receiptBody}>
          <Text style={styles.rHead}>{receiptData.stationName}</Text>
          <Text style={styles.rSub}>Code: {receiptData.stationCode}</Text>
          <Text style={styles.rDivider}>- - - - - - - - - - - - - - - - - - -</Text>

          <RRow label="Receipt #" value={id || '---'} />
          <RRow label="Operator" value={receiptData.operator} />
          <RRow label="Date" value={receiptData.date} />
          <RRow label="Time" value={receiptData.time} />
          <Text style={styles.rDivider}>- - - - - - - - - - - - - - - - - - -</Text>

          <RRow label="Driver" value={receiptData.driverName} />
          <RRow label="Truck" value={receiptData.truckPlate} />
          <Text style={styles.rDivider}>- - - - - - - - - - - - - - - - - - -</Text>

          <RRow label="GROSS (IN)" value={`${wIn.toFixed(1)} T`} bold />
          {isWeighOut && <RRow label="TARE (OUT)" value={`${wOut.toFixed(1)} T`} />}
          {isWeighOut && <Text style={styles.rDivider}>- - - - - - - - - - - - - - - - - - -</Text>}
          {isWeighOut && (
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>NET WEIGHT</Text>
              <Text style={styles.netValue}>{net.toFixed(1)} T</Text>
            </View>
          )}

          <Text style={styles.rDivider}>- - - - - - - - - - - - - - - - - - -</Text>

          <View style={[styles.stampArea, { backgroundColor: isWeighOut ? '#DCFCE7' : '#FEF3C7', borderColor: isWeighOut ? '#16A34A' : '#D97706' }]}>
            <Ionicons name={isWeighOut ? 'checkmark-circle' : 'time'} size={18} color={isWeighOut ? '#16A34A' : '#D97706'} />
            <Text style={[styles.stampText, { color: isWeighOut ? '#16A34A' : '#D97706' }]}>{receiptData.remarks}</Text>
          </View>

          <Text style={styles.rDivider}>- - - - - - - - - - - - - - - - - - -</Text>
          <Text style={styles.rBarcode}>||| ||| ||| ||| ||| ||| ||| |||</Text>
          <Text style={styles.rFooter}>Valid weighbridge certificate</Text>
          <Text style={styles.rThanks}>Thank you - Drive Safe</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#FFF" />
          <Text style={styles.actionBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => router.back()}>
          <Text style={[styles.actionBtnTextAlt, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const RRow = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <View style={styles.rRow}>
    <Text style={styles.rLabel}>{label}</Text>
    <Text style={[styles.rValue, bold && { fontWeight: '800' }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },

  // Supermarket-style receipt
  receipt: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.xl, marginBottom: Spacing.lg },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptTitle: { fontSize: 16, fontWeight: '800', color: '#333', letterSpacing: 1, marginTop: 4 },
  receiptLine: { width: '80%', height: 1, backgroundColor: '#DDD', marginTop: Spacing.sm },
  receiptBody: { padding: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  rSub: { fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 4 },
  rDivider: { textAlign: 'center', color: '#CCC', marginVertical: 4, fontSize: 11 },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rLabel: { fontSize: 12, color: '#666', flex: 1 },
  rValue: { fontSize: 13, color: '#333', textAlign: 'right' },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  netLabel: { fontSize: 14, fontWeight: '700', color: '#333' },
  netValue: { fontSize: 22, fontWeight: '800', color: '#2563EB' },
  stampArea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1 },
  stampText: { fontSize: 11, fontWeight: '600' },
  rBarcode: { textAlign: 'center', fontSize: 14, color: '#333', letterSpacing: 2, marginTop: 8 },
  rFooter: { textAlign: 'center', fontSize: 10, color: '#999', marginTop: 2 },
  rThanks: { textAlign: 'center', fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  actionBtnTextAlt: { fontSize: 14, fontWeight: '600' },
});
