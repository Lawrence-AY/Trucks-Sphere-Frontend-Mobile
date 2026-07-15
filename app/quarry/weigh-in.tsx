import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDrivers, fetchVehicles } from '../../services/api';

export default function WeighInScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [selectedTruck, setSelectedTruck] = useState<any>(null);
  const [weightIn, setWeightIn] = useState('');
  const [material, setMaterial] = useState('Ballast');

  const [drivers, setDrivers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);

  useEffect(() => {
    console.log('[WeighIn] Fetching drivers and vehicles...');
    Promise.all([fetchDrivers(), fetchVehicles()]).then(([d, t]) => {
      console.log('[WeighIn] Loaded drivers:', d.length, 'trucks:', t.length);
      setDrivers(d);
      setTrucks(t);
    }).catch(err => console.error('[WeighIn] Failed to load data:', err));
  }, []);

  const available = drivers.filter(d => d.status === 'active' || d.status === 'on_trip')
    .map(d => {
      const truck = trucks.find(t => t.assignedDriverId === d.id || t.driverName === d.name);
      return { ...d, truck };
    })
    .filter(item => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (item.name || '').toLowerCase().includes(q) ||
        (item.phone || '').includes(q) ||
        (item.truck?.plate || item.truck?.plateNumber || '').toLowerCase().includes(q);
    });

  const handleSelectDriver = (driver: any) => {
    setSelectedDriver(driver);
    setSelectedTruck(driver.truck);
    setStep(1);
  };

  const handleCaptureWeight = () => {
    if (!weightIn || isNaN(Number(weightIn)) || Number(weightIn) <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight value');
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
    setMaterial('Ballast');
  };

  // Step 3: Receipt
  if (step === 3) {
    const receiptData = {
      station: 'Athi River Quarry',
      stationCode: 'QRY-ATH-001',
      operator: user?.name || 'Operator',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      driver: selectedDriver?.name || '',
      truck: selectedTruck?.plate || selectedTruck?.plateNumber || '',
      material,
      weightIn: Number(weightIn),
      jobId: `WB-${Date.now().toString(36).toUpperCase()}`,
    };

    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={[styles.receiptCard, { backgroundColor: colors.surface }]}>
          <View style={styles.receiptHeader}>
            <View style={[styles.receiptIcon, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="scale" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.receiptTitle, { color: colors.text }]}>WEIGHBRIDGE TICKET</Text>
            <Text style={[styles.receiptSub, { color: colors.textSecondary }]}>Weigh-In Complete</Text>
          </View>

          <View style={styles.receiptDivider} />

          <View style={styles.receiptBody}>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Station</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{receiptData.station}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Code</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{receiptData.stationCode}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Job ID</Text>
              <Text style={[styles.rValue, { color: colors.text, fontWeight: '700' }]}>{receiptData.jobId}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Operator</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{receiptData.operator}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Date</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{receiptData.date}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Time</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{receiptData.time}</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Driver</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{receiptData.driver}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Truck</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{receiptData.truck}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Material</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{receiptData.material}</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.weightDisplay}>
              <Text style={[styles.weightLabel, { color: colors.textSecondary }]}>GROSS WEIGHT</Text>
              <Text style={[styles.weightValue, { color: colors.primary }]}>{receiptData.weightIn.toFixed(1)} T</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleReset}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>New Weigh-In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => {
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
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.driverCard, { backgroundColor: colors.surface }]}
              onPress={() => handleSelectDriver(item)}
              activeOpacity={0.7}
            >
              <View style={styles.driverInfo}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {item.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.driverName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.driverDetail, { color: colors.textSecondary }]}>{item.phone}</Text>
                  {item.truck && (
                    <View style={styles.truckBadge}>
                      <Ionicons name="car" size={12} color={colors.primary} />
                      <Text style={[styles.truckInfo, { color: colors.primary }]}>
                        {item.truck.plate} — {item.truck.model}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="people-outline" size={36} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No drivers found</Text>
            </View>
          }
        />
      </View>
    );
  }

  // Step 1: Verify & Capture Weight
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.verifyCard, { backgroundColor: colors.surface }]}>
        <View style={styles.verifyHeader}>
          <View style={[styles.verifyIcon, { backgroundColor: colors.primary + '12' }]}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.verifyTitle, { color: colors.text }]}>Verify Details</Text>
        </View>

        <View style={styles.verifyBody}>
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
          <View style={styles.verifyDivider} />
          <View style={styles.verifyRow}>
            <Text style={[styles.vLabel, { color: colors.textSecondary }]}>Truck</Text>
            <Text style={[styles.vValue, { color: colors.text, fontWeight: '700' }]}>{selectedTruck?.plate || selectedTruck?.plateNumber}</Text>
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
      </View>

      <View style={[styles.inputCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.inputTitle, { color: colors.text }]}>Capture Weight</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Material</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={material}
              onChangeText={setMaterial}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gross Weight (Tons)</Text>
          <View style={[styles.inputWrap, { borderColor: colors.primary, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.input, { color: colors.text, fontSize: 24, fontWeight: '800' }]}
              placeholder="0.0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={weightIn}
              onChangeText={setWeightIn}
            />
            <Text style={[styles.inputSuffix, { color: colors.textSecondary }]}>T</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={handleCaptureWeight}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
          <Text style={styles.actionBtnText}>Complete Weigh-In</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.cancelBtn, { borderColor: colors.border }]}
        onPress={handleReset}
      >
        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
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
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchText: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm,
  },
  driverInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  driverName: { fontSize: 15, fontWeight: '600' },
  driverDetail: { fontSize: 13 },
  truckBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  truckInfo: { fontSize: 12, fontWeight: '600' },
  verifyCard: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  verifyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  verifyIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  verifyTitle: { fontSize: 16, fontWeight: '700' },
  verifyBody: {},
  verifyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  vLabel: { fontSize: 13 },
  vValue: { fontSize: 14 },
  verifyDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: Spacing.sm },
  inputCard: { borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  inputTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  inputGroup: { marginBottom: Spacing.md },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  inputWrap: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 48, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15 },
  inputSuffix: { fontSize: 14, fontWeight: '600', marginLeft: 4 },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, marginTop: Spacing.sm },
  cancelText: { fontSize: 14, fontWeight: '600' },
  // Receipt
  receiptCard: { borderRadius: Radius.lg, padding: Spacing.xl, marginBottom: Spacing.lg },
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
