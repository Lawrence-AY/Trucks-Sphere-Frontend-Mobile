import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { MOCK_DRIVERS, MOCK_TRUCKS, MOCK_WEIGHMENTS } from '../../store/mockData';

export default function WeighInScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0); // 0: search, 1: verify, 2: weigh, 3: receipt
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [selectedTruck, setSelectedTruck] = useState<any>(null);
  const [weightIn, setWeightIn] = useState('');

  // Filter available drivers/trucks
  const available = MOCK_DRIVERS.filter(d => d.status === 'active' || d.status === 'on_trip')
    .map(d => {
      const truck = MOCK_TRUCKS.find(t => t.driverName === d.name);
      return { ...d, truck };
    })
    .filter(item => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        (item.truck?.plate || '').toLowerCase().includes(q);
    });

  const handleSelectDriver = (driver: any) => {
    setSelectedDriver(driver);
    setSelectedTruck(driver.truck);
    setStep(1);
  };

  const handleCaptureWeight = () => {
    if (!weightIn || isNaN(Number(weightIn)) || Number(weightIn) <= 0) {
      Alert.alert('Error', 'Please enter a valid weight');
      return;
    }
    setStep(3);
  };

  const handleReset = () => {
    setStep(0);
    setSelectedDriver(null);
    setSelectedTruck(null);
    setWeightIn('');
    setSearchQuery('');
  };

  // Step 3: Receipt view
  if (step === 3) {
    const receiptData = {
      station: 'Athi River Quarry',
      stationCode: 'QRY-ATH-001',
      operator: user?.name || 'Operator',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      driver: selectedDriver?.name || '',
      truck: selectedTruck?.plate || '',
      material: 'Ballast',
      weightIn: Number(weightIn),
      jobId: `WB-${Date.now().toString(36).toUpperCase()}`,
    };

    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        {/* Receipt Card - Supermarket Style */}
        <View style={[styles.receipt, { backgroundColor: '#FFFDF7', borderColor: '#E5E0D0' }]}>
          <View style={styles.receiptHeader}>
            <Ionicons name="scale" size={28} color="#333" />
            <Text style={styles.receiptTitle}>WEIGHBRIDGE TICKET</Text>
            <View style={styles.receiptLine} />
          </View>

          <View style={styles.receiptBody}>
            <Text style={styles.rHead}>{receiptData.station}</Text>
            <Text style={styles.rSub}>Code: {receiptData.stationCode}</Text>
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <ReceiptRow label="Job ID" value={receiptData.jobId} bold />
            <ReceiptRow label="Operator" value={receiptData.operator} />
            <ReceiptRow label="Date" value={receiptData.date} />
            <ReceiptRow label="Time" value={receiptData.time} />
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <ReceiptRow label="Driver" value={receiptData.driver} />
            <ReceiptRow label="Truck" value={receiptData.truck} />
            <ReceiptRow label="Material" value={receiptData.material} />
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <View style={styles.weightRow}>
              <Text style={styles.weightLabel}>GROSS WEIGHT</Text>
              <Text style={styles.weightValue}>{receiptData.weightIn.toFixed(1)} T</Text>
            </View>
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <Text style={styles.rFooter}>WEIGH-IN COMPLETE</Text>
            <Text style={styles.rTime}>{receiptData.date} {receiptData.time}</Text>
            <Text style={styles.rBarcode}>||| ||| ||| ||| ||| |||</Text>
            <Text style={styles.rThanks}>Thank you</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={handleReset}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>New Weigh-In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#16A34A' }]} onPress={() => {
            router.push(`/screens/weigh-receipt?id=${receiptData.jobId}&weightIn=${receiptData.weightIn}&driver=${encodeURIComponent(receiptData.driver)}&truck=${receiptData.truck}`);
          }}>
            <Ionicons name="share-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>View Receipt</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Step 0: Search/Select
  if (step === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.stepHeader}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>Select Driver & Truck</Text>
          <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Search for driver or truck plate</Text>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: colors.text }]}
            placeholder="Search driver name, phone or plate..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={available}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.driverCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleSelectDriver(item)}
            >
              <View style={styles.driverInfo}>
                <View style={[styles.avatar, { backgroundColor: colors.accent + '15' }]}>
                  <Text style={[styles.avatarText, { color: colors.accent }]}>
                    {item.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.driverName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.driverDetail, { color: colors.textSecondary }]}>{item.phone}</Text>
                  {item.truck && (
                    <Text style={[styles.truckInfo, { color: colors.accent }]}>🚛 {item.truck.plate} — {item.truck.model}</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // Step 1: Verify & Capture Weight
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.verifyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.verifyTitle, { color: colors.text }]}>Verify Driver & Truck</Text>
        <View style={styles.verifyRow}>
          <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Driver</Text>
          <Text style={[styles.vValue, { color: colors.text }]}>{selectedDriver?.name}</Text>
        </View>
        <View style={styles.verifyRow}>
          <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Phone</Text>
          <Text style={[styles.vValue, { color: colors.text }]}>{selectedDriver?.phone}</Text>
        </View>
        <View style={styles.verifyRow}>
          <Text style={[styles.vLabel, { color: colors.textSecondary }]}>License</Text>
          <Text style={[styles.vValue, { color: colors.text }]}>{selectedDriver?.licenseNumber}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.verifyRow}>
          <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Truck</Text>
          <Text style={[styles.vValue, { color: colors.text, fontWeight: '700' }]}>{selectedTruck?.plate}</Text>
        </View>
        <View style={styles.verifyRow}>
          <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Model</Text>
          <Text style={[styles.vValue, { color: colors.text }]}>{selectedTruck?.model}</Text>
        </View>
        <View style={styles.verifyRow}>
          <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Capacity</Text>
          <Text style={[styles.vValue, { color: colors.text }]}>{selectedTruck?.capacity}T</Text>
        </View>
      </View>

      {/* Material selection + Weight input */}
      <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.inputTitle, { color: colors.text }]}>Capture Weight</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Material</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              defaultValue="Ballast"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gross Weight (Tons)</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontSize: 22, fontWeight: '800' }]}
              placeholder="0.0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={weightIn}
              onChangeText={setWeightIn}
            />
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          onPress={handleCaptureWeight}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
          <Text style={styles.actionBtnText}>Complete Weigh-In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
          onPress={handleReset}
        >
          <Text style={[styles.actionBtnTextAlt, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Fix: import missing TextInput and FlatList at top - they're already imported from react-native
import { TextInput as RNTextInput, FlatList } from 'react-native'; // alias to avoid confusion
import { TextInput as TInput } from 'react-native';

const ReceiptRow = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <View style={styles.rRow}>
    <Text style={styles.rLabel}>{label}</Text>
    <Text style={[styles.rValue, bold && { fontWeight: '800' }]}>{value}</Text>
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
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchText: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm,
  },
  driverInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  driverName: { fontSize: 15, fontWeight: '600' },
  driverDetail: { fontSize: 13 },
  truckInfo: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  verifyCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  verifyTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  verifyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  vLabel: { fontSize: 13 },
  vValue: { fontSize: 14 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: Spacing.sm },
  inputCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  inputTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  inputWrap: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 48, justifyContent: 'center' },
  input: { fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  actionBtnTextAlt: { fontSize: 14, fontWeight: '600' },

  // Receipt styles (supermarket-style)
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
