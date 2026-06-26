import { useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { MOCK_DELIVERIES } from '../../store/mockData';

export default function ReceiveScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<any>(null);

  const pending = MOCK_DELIVERIES.filter((d) => d.status === 'in_transit')
    .filter((d) =>
      (d.jobId || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (d.truckPlate || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (d.material || '').toLowerCase().includes((search || '').toLowerCase())
    );

  if (step === 1 && selected) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={[styles.receiptCard, { backgroundColor: colors.surface }]}>
          <View style={styles.receiptHeader}>
            <View style={[styles.receiptIcon, { backgroundColor: '#10B98112' }]}>
              <Ionicons name="document-text" size={28} color="#10B981" />
            </View>
            <Text style={[styles.receiptTitle, { color: colors.text }]}>DELIVERY NOTE</Text>
            <Text style={[styles.receiptSub, { color: colors.textSecondary }]}>Received and Confirmed</Text>
          </View>

          <View style={styles.receiptDivider} />

          <View style={styles.receiptBody}>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Job ID</Text>
              <Text style={[styles.rValue, { color: colors.text, fontWeight: '700' }]}>{selected.jobId}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Site</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{selected.siteLocation}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Vendor</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{selected.vendorName}</Text>
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
            <View style={styles.receiptRow}>
              <Text style={[styles.rLabel, { color: colors.textSecondary }]}>Quantity</Text>
              <Text style={[styles.rValue, { color: colors.text }]}>{selected.quantity}T</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.confirmedBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.confirmedText}>RECEIVED AND CONFIRMED</Text>
            </View>
            <Text style={[styles.receiptTime, { color: colors.textTertiary }]}>
              {new Date().toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => { setStep(0); setSelected(null); }}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>New Receive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/screens/delivery-note?id=${selected.jobId}`)}
          >
            <Ionicons name="share-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Share Note</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: '#10B98110' }]}>
              <Ionicons name="download-outline" size={40} color="#10B981" />
            </View>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pending deliveries</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              In-transit deliveries will appear here
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemCard, { backgroundColor: colors.surface }]}
            onPress={() => { setSelected(item); setStep(1); }}
            activeOpacity={0.7}
          >
            <View style={styles.itemTop}>
              <View style={[styles.itemBadge, { backgroundColor: '#10B98112' }]}>
                <Ionicons name="navigate" size={14} color="#10B981" />
                <Text style={[styles.itemStatus, { color: '#10B981' }]}>IN TRANSIT</Text>
              </View>
              <Text style={[styles.itemPlate, { color: colors.text }]}>{item.truckPlate}</Text>
            </View>
            <Text style={[styles.itemJob, { color: colors.text }]}>{item.jobId}</Text>
            <View style={styles.itemDetails}>
              <View style={styles.itemRow}>
                <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.itemText, { color: colors.textSecondary }]}>{item.material} - {item.quantity}T</Text>
              </View>
              <View style={styles.itemRow}>
                <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.itemText, { color: colors.textSecondary }]}>{item.vendorName}</Text>
              </View>
              <View style={styles.itemRow}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.itemText, { color: colors.textSecondary }]}>{item.siteLocation}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
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
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, borderRadius: Radius.md,
    borderWidth: 1, paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  list: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  itemCard: {
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  itemBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  itemStatus: { fontSize: 10, fontWeight: '700' },
  itemPlate: { fontSize: 13, fontWeight: '600' },
  itemJob: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
  itemDetails: { gap: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemText: { fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  receiptCard: { borderRadius: Radius.lg, padding: Spacing.xl, marginBottom: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  receiptTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  receiptSub: { fontSize: 12, marginTop: 2 },
  receiptDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: Spacing.md },
  receiptBody: { gap: 8 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  rLabel: { fontSize: 13 },
  rValue: { fontSize: 13, flex: 1, textAlign: 'right' },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  confirmedText: { fontSize: 14, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 },
  receiptTime: { textAlign: 'center', fontSize: 11 },
});
