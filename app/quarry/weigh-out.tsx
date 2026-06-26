import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Alert, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { MOCK_WEIGHMENTS } from '../../store/mockData';

export default function WeighOutScreen() {
  const colors = useTheme();
  const [step, setStep] = useState(0); // 0: select, 1: capture, 2: receipt
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [weightOut, setWeightOut] = useState('');

  const pending = MOCK_WEIGHMENTS.filter(w => w.status === 'weighed_in' || w.status === 'pending')
    .filter(w =>
      (w.truckPlate || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (w.driverName || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (w.id || '').toLowerCase().includes((search || '').toLowerCase())
    );

  const handleSelect = (item: any) => {
    setSelected(item);
    setStep(1);
  };

  const handleComplete = () => {
    if (!weightOut || isNaN(Number(weightOut)) || Number(weightOut) <= 0) {
      Alert.alert('Error', 'Please enter a valid weight-out value');
      return;
    }
    setStep(2);
  };

  if (step === 2 && selected) {
    const wIn = selected.weightIn || 0;
    const wOut = Number(weightOut);
    const net = wIn - wOut;

    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={[styles.receipt, { backgroundColor: '#FFFDF7', borderColor: '#E5E0D0' }]}>
          <View style={styles.receiptHeader}>
            <Ionicons name="scale" size={28} color="#333" />
            <Text style={styles.receiptTitle}>WEIGH-OUT TICKET</Text>
            <View style={styles.receiptLine} />
          </View>
          <View style={styles.receiptBody}>
            <Text style={styles.rHead}>Athi River Quarry</Text>
            <Text style={styles.rSub}>Job: {selected.id}</Text>
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <RRow label="Driver" value={selected.driverName} />
            <RRow label="Truck" value={selected.truckPlate} />
            <RRow label="Material" value={selected.material} />
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <RRow label="Gross (In)" value={`${wIn.toFixed(1)} T`} />
            <RRow label="Tare (Out)" value={`${wOut.toFixed(1)} T`} />
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <View style={styles.weightRow}>
              <Text style={styles.weightLabel}>NET WEIGHT</Text>
              <Text style={styles.weightValue}>{net.toFixed(1)} T</Text>
            </View>
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <Text style={styles.rFooter}>WEIGH-OUT COMPLETE</Text>
            <Text style={styles.rTime}>{new Date().toLocaleString()}</Text>
            <Text style={styles.rBarcode}>||| ||| ||| ||| ||| ||| |||</Text>
            <Text style={styles.rThanks}>Thank you - Drive Safe</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={() => setStep(0)}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>New Weigh-Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#16A34A' }]} onPress={() => {
            router.push(`/screens/weigh-receipt?id=${selected.id}&weightIn=${wIn}&weightOut=${wOut}`);
          }}>
            <Ionicons name="share-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (step === 1 && selected) {
    const wIn = selected.weightIn || 0;
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={[styles.verifyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.verifyTitle, { color: colors.text }]}>Weigh-Out</Text>
          <VRRow colors={colors} label="Job ID" value={selected.id} />
          <VRRow colors={colors} label="Driver" value={selected.driverName} />
          <VRRow colors={colors} label="Truck" value={selected.truckPlate} />
          <VRRow colors={colors} label="Material" value={selected.material} />
          <VRRow colors={colors} label="Weight In" value={`${wIn.toFixed(1)} T`} bold />
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.inputTitle, { color: colors.text }]}>Enter Tare Weight (Out)</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontSize: 24, fontWeight: '800' }]}
              placeholder="0.0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={weightOut}
              onChangeText={setWeightOut}
            />
          </View>
          {weightOut && !isNaN(Number(weightOut)) && (
            <View style={styles.netPreview}>
              <Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net Weight (Est.)</Text>
              <Text style={[styles.netValue, { color: colors.accent }]}>{(wIn - Number(weightOut)).toFixed(1)} T</Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={handleComplete}>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Complete Weigh-Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setStep(0)}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Select Weigh-In Record</Text>
        <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Choose a record to complete weigh-out</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchText, { color: colors.text }]}
          placeholder="Search by plate, driver or job ID..."
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
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleSelect(item)}
          >
            <View style={styles.itemLeft}>
              <Text style={[styles.itemPlate, { color: colors.accent }]}>{item.truckPlate}</Text>
              <Text style={[styles.itemDriver, { color: colors.textSecondary }]}>{item.driverName}</Text>
              <Text style={[styles.itemMaterial, { color: colors.textTertiary }]}>{item.material}</Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={[styles.itemWeight, { color: colors.text }]}>{item.weightIn?.toFixed(1)}T</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
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

const VRRow = ({ colors, label, value, bold }: { colors: any; label: string; value: string; bold?: boolean }) => (
  <View style={styles.verifyRow}>
    <Text style={[styles.vLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.vValue, { color: colors.text }, bold && { fontWeight: '700' }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  stepHeader: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  stepTitle: { fontSize: 20, fontWeight: '700' },
  stepSub: { fontSize: 13, marginTop: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, borderRadius: Radius.md,
    borderWidth: 1, paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchText: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  itemCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm,
  },
  itemLeft: { flex: 1 },
  itemPlate: { fontSize: 15, fontWeight: '700' },
  itemDriver: { fontSize: 13, marginTop: 2 },
  itemMaterial: { fontSize: 12, marginTop: 1 },
  itemRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  itemWeight: { fontSize: 16, fontWeight: '700' },
  verifyCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  verifyTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  verifyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  vLabel: { fontSize: 13 },
  vValue: { fontSize: 14 },
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  inputTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  inputWrap: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 56, justifyContent: 'center' },
  input: { fontSize: 15 },
  netPreview: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  netLabel: { fontSize: 13 },
  netValue: { fontSize: 20, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  cancelText: { fontSize: 14, fontWeight: '600' },

  // Receipt styles
  receipt: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.xl, marginBottom: Spacing.lg },
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
  weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  weightLabel: { fontSize: 14, fontWeight: '700', color: '#333' },
  weightValue: { fontSize: 20, fontWeight: '800', color: '#2563EB' },
  rFooter: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#16A34A', marginTop: 8 },
  rTime: { textAlign: 'center', fontSize: 10, color: '#999', marginTop: 2 },
  rBarcode: { textAlign: 'center', fontSize: 14, color: '#333', letterSpacing: 2, marginTop: 8 },
  rThanks: { textAlign: 'center', fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
});
