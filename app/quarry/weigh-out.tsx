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
  const [step, setStep] = useState(0);
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
      Alert.alert('Invalid Weight', 'Please enter a valid weight-out value');
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
        <View style={[styles.receiptCard, { backgroundColor: colors.surface }]}>
          <View style={styles.receiptHeader}>
            <View style={[styles.receiptIcon, { backgroundColor: '#7C3AED12' }]}>
              <Ionicons name="scale" size={28} color="#7C3AED" />
            </View>
            <Text style={[styles.receiptTitle, { color: colors.text }]}>WEIGH-OUT TICKET</Text>
            <Text style={[styles.receiptSub, { color: colors.textSecondary }]}>Weigh-Out Complete</Text>
          </View>

          <View style={styles.receiptDivider} />

          <View style={styles.receiptBody}>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Job ID</Text>
              <Text style={[styles.rValue, { color: colors.text, fontWeight: '700' }]}>{selected.id}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Driver</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{selected.driverName}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Truck</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{selected.truckPlate}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Material</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{selected.material}</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Gross (In)</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{wIn.toFixed(1)} T</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Tare (Out)</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{wOut.toFixed(1)} T</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.weightDisplay}>
              <Text style={[styles.weightLabel, { color: colors.textSecondary }]}>NET WEIGHT</Text>
              <Text style={[styles.weightValue, { color: '#7C3AED' }]}>{net.toFixed(1)} T</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]} onPress={() => { setStep(0); setSelected(null); setWeightOut(''); }}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>New Weigh-Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => {
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
        <View style={[styles.verifyCard, { backgroundColor: colors.surface }]}>
          <View style={styles.verifyHeader}>
            <View style={[styles.verifyIcon, { backgroundColor: '#7C3AED12' }]}>
              <Ionicons name="checkmark-circle" size={22} color="#7C3AED" />
            </View>
            <Text style={[styles.verifyTitle, { color: colors.text }]}>Weigh-Out Details</Text>
          </View>

          <View style={styles.verifyBody}>
            <View style={styles.verifyRow}>
              <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Job ID</Text>
              <Text style={[styles.vValue, { color: colors.text }]}>{selected.id}</Text>
            </View>
            <View style={styles.verifyRow}>
              <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Driver</Text>
              <Text style={[styles.vValue, { color: colors.text }]}>{selected.driverName}</Text>
            </View>
            <View style={styles.verifyRow}>
              <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Truck</Text>
              <Text style={[styles.vValue, { color: colors.text, fontWeight: '700' }]}>{selected.truckPlate}</Text>
            </View>
            <View style={styles.verifyRow}>
              <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Material</Text>
              <Text style={[styles.vValue, { color: colors.text }]}>{selected.material}</Text>
            </View>
            <View style={styles.verifyDivider} />
            <View style={styles.verifyRow}>
              <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Weight In</Text>
              <Text style={[styles.vValue, { color: colors.text, fontWeight: '700' }]}>{wIn.toFixed(1)} T</Text>
            </View>
          </View>
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.inputTitle, { color: colors.text }]}>Enter Tare Weight (Out)</Text>
          <View style={[styles.inputWrap, { borderColor: '#7C3AED', backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontSize: 24, fontWeight: '800' }]}
              placeholder="0.0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={weightOut}
              onChangeText={setWeightOut}
            />
            <Text style={[styles.inputSuffix, { color: colors.textSecondary }]}>T</Text>
          </View>
          {weightOut && !isNaN(Number(weightOut)) && (
            <View style={styles.netPreview}>
              <Text style={[styles.netLabel, { color: colors.textSecondary }]}>Net Weight (Est.)</Text>
              <Text style={[styles.netValue, { color: '#7C3AED' }]}>{(wIn - Number(weightOut)).toFixed(1)} T</Text>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]} onPress={handleComplete}>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Complete Weigh-Out</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: colors.border }]}
          onPress={() => setStep(0)}
        >
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
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
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemCard, { backgroundColor: colors.surface }]}
            onPress={() => handleSelect(item)}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <Text style={[styles.itemPlate, { color: '#7C3AED' }]}>{item.truckPlate}</Text>
              <Text style={[styles.itemDriver, { color: colors.textSecondary }]}>{item.driverName}</Text>
              <Text style={[styles.itemMaterial, { color: colors.textTertiary }]}>{item.material}</Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={[styles.itemWeight, { color: colors.text }]}>{item.weightIn?.toFixed(1)}T</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: '#7C3AED10' }]}>
              <Ionicons name="scale-outline" size={36} color="#7C3AED" />
            </View>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pending weigh-outs</Text>
          </View>
        }
      />
    </View>
  );
}

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
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  itemLeft: { flex: 1 },
  itemPlate: { fontSize: 15, fontWeight: '700' },
  itemDriver: { fontSize: 13, marginTop: 2 },
  itemMaterial: { fontSize: 12, marginTop: 1 },
  itemRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  itemWeight: { fontSize: 16, fontWeight: '700' },
  verifyCard: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  verifyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  verifyIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  verifyTitle: { fontSize: 16, fontWeight: '700' },
  verifyBody: {},
  verifyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  vLabel: { fontSize: 13 },
  vValue: { fontSize: 14 },
  verifyDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: Spacing.sm },
  inputCard: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  inputTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  inputWrap: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 56, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15 },
  inputSuffix: { fontSize: 14, fontWeight: '600', marginLeft: 4 },
  netPreview: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  netLabel: { fontSize: 13 },
  netValue: { fontSize: 20, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm },
  cancelText: { fontSize: 14, fontWeight: '600' },
  // Receipt
  receiptCard: { borderRadius: Radius.lg, padding: Spacing.xl, marginBottom: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  receiptTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  receiptSub: { fontSize: 12, marginTop: 2 },
  receiptDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: Spacing.md },
  receiptBody: { gap: 8 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rLabel: { fontSize: 13 },
  rValue: { fontSize: 13 },
  weightDisplay: { alignItems: 'center', paddingVertical: Spacing.md },
  weightLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  weightValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600' },
});
