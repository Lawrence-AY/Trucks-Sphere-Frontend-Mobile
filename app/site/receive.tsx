import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { MOCK_DELIVERIES } from '../../store/mockData';

export default function ReceiveScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [deliveryNote, setDeliveryNote] = useState('');

  const pending = MOCK_DELIVERIES.filter(d => d.status === 'in_transit')
    .filter(d =>
      (d.jobId || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (d.truckPlate || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (d.material || '').toLowerCase().includes((search || '').toLowerCase())
    );

  if (step === 1 && selected) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.receiptCard, { backgroundColor: '#FFFDF7', borderColor: '#E5E0D0' }]}>
          <View style={styles.receiptHeader}>
            <Ionicons name="document-text" size={28} color="#333" />
            <Text style={styles.receiptTitle}>DELIVERY NOTE</Text>
            <View style={styles.receiptLine} />
          </View>
          <View style={styles.receiptBody}>
            <Text style={styles.rHead}>Site: {selected.siteLocation}</Text>
            <Text style={styles.rSub}>Job: {selected.jobId}</Text>
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <RRow label="Vendor" value={selected.vendorName} />
            <RRow label="Driver" value={selected.driverName} />
            <RRow label="Truck" value={selected.truckPlate} />
            <RRow label="Material" value={selected.material} />
            <RRow label="Qty" value={`${selected.quantity}T`} />
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <Text style={styles.rFooter}>✓ RECEIVED & CONFIRMED</Text>
            <Text style={styles.rTime}>{new Date().toLocaleString()}</Text>
            <Text style={styles.rBarcode}>||| ||| ||| ||| ||| ||| |||</Text>
            <Text style={styles.rThanks}>Site Operator</Text>
            {/* Delivery Note from Site */}
            <View style={styles.noteWrap}>
              <Text style={styles.noteLabel}>Delivery Note:</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note about this delivery..."
                placeholderTextColor="#999"
                value={deliveryNote}
                onChangeText={setDeliveryNote}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={() => setStep(0)}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>New Receive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#16A34A' }]}
            onPress={() => router.push(`/screens/delivery-note?id=${selected.jobId}`)}
          >
            <Ionicons name="share-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Share Note</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Receive Delivery</Text>
        <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Search for a delivery by Job ID</Text>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Job ID, plate or material..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={pending}
        keyExtractor={(item) => item.jobId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="download-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pending deliveries</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => { setSelected(item); setStep(1); }}
          >
            <View style={styles.itemTop}>
              <Text style={[styles.itemJob, { color: colors.accent }]}>{item.jobId}</Text>
              <Text style={[styles.itemPlate, { color: colors.text }]}>{item.truckPlate}</Text>
            </View>
            <View style={styles.itemRow}>
              <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.itemText, { color: colors.textSecondary }]}>{item.material} — {item.quantity}T</Text>
            </View>
            <View style={styles.itemRow}>
              <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.itemText, { color: colors.textSecondary }]}>{item.vendorName}</Text>
            </View>
            <View style={styles.itemRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.itemText, { color: colors.textSecondary }]}>{item.siteLocation}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const RRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.rRow}>
    <Text style={styles.rLabel}>{label}</Text>
    <Text style={styles.rValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepHeader: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  stepTitle: { fontSize: 20, fontWeight: '700' },
  stepSub: { fontSize: 13, marginTop: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, borderRadius: Radius.md,
    borderWidth: 1, paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  itemCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  itemJob: { fontSize: 14, fontWeight: '700' },
  itemPlate: { fontSize: 13, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 4 },
  itemText: { fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, marginTop: Spacing.md },
  actionRow: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  receiptCard: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.xl, marginHorizontal: Spacing.lg, marginTop: Spacing.lg },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptTitle: { fontSize: 16, fontWeight: '800', color: '#333', letterSpacing: 1, marginTop: 4 },
  receiptLine: { width: '80%', height: 1, backgroundColor: '#DDD', marginTop: Spacing.sm },
  receiptBody: { padding: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  rSub: { fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 4 },
  rDash: { textAlign: 'center', color: '#999', marginVertical: 4, fontSize: 12 },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rLabel: { fontSize: 12, color: '#666' },
  rValue: { fontSize: 13, color: '#333' },
  rFooter: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#16A34A', marginTop: 8 },
  rTime: { textAlign: 'center', fontSize: 10, color: '#999', marginTop: 2 },
  rBarcode: { textAlign: 'center', fontSize: 14, color: '#333', letterSpacing: 2, marginTop: 8 },
  rThanks: { textAlign: 'center', fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  noteWrap: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#DDD', paddingTop: 8 },
  noteLabel: { fontSize: 11, fontWeight: '700', color: '#333', marginBottom: 4 },
  noteInput: {
    fontSize: 12,
    color: '#333',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    padding: 8,
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },
});
