import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ScrollView, Share, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchDeliveryOrders, updateDeliveryOrder } from '../../services/api';

function RRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rRow}>
      <Text style={styles.rLabel}>{label}</Text>
      <Text style={styles.rValue}>{value}</Text>
    </View>
  );
}

export default function ReceiveScreen() {
  const colors = useTheme();
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    console.log('[ReceiveScreen] Fetching delivery orders...');
    fetchDeliveryOrders().then(data => {
      console.log('[ReceiveScreen] Delivery orders loaded:', data.length, 'items');
      setDeliveries(data);
    }).catch(err => console.error('[ReceiveScreen] Failed to fetch deliveries:', err));
  }, []);

  const handleReceive = async () => {
    if (!selected || saved) return;
    setSaving(true);
    try {
      const deliveredQty = Number(selected.quantity || selected.quantityOrdered || selected.netWeight || 0);
      await updateDeliveryOrder(selected.id || selected.jobId, {
        status: 'delivered',
        quantityDelivered: deliveredQty,
        receivedAt: new Date().toISOString(),
        deliveryNote: deliveryNote || undefined,
      });
      console.log('[ReceiveScreen] Delivery marked as delivered:', selected.jobId);
      setSaved(true);
    } catch (err) {
      console.error('[ReceiveScreen] Failed to update delivery:', err);
    } finally {
      setSaving(false);
    }
  };

  const pending = deliveries.filter((d: any) => d.status === 'in_transit' || d.status === 'in_transit_to_site')
    .filter((d: any) =>
      (d.jobId || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (d.truckPlate || d.plateNumber || '').toLowerCase().includes((search || '').toLowerCase()) ||
      (d.material || d.materialName || '').toLowerCase().includes((search || '').toLowerCase())
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
            <Text style={[styles.receiptSub, { color: colors.textSecondary }]}>Received & Confirmed</Text>
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

            {saved ? (
              <View style={styles.confirmedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.confirmedText}>RECEIVED & CONFIRMED</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.confirmReceiveBtn, { backgroundColor: '#10B981' }]}
                onPress={handleReceive}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                    <Text style={styles.confirmReceiveText}>Confirm Receipt</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <Text style={[styles.receiptTime, { color: colors.textTertiary }]}>
              {new Date().toLocaleString()}
            </Text>
            <Text style={styles.rHead}>Site: {selected.siteLocation}</Text>
            <Text style={styles.rSub}>Job: {selected.jobId}</Text>
            <Text style={styles.rDash}>- - - - - - - - - - - - - - - -</Text>
            <RRow label="Vendor" value={selected.vendorName} />
            <RRow label="Driver" value={selected.driverName} />
            <RRow label="Truck" value={selected.truckPlate} />
            <RRow label="Material" value={selected.material} />
            
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
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => { setStep(0); setSelected(null); }}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>New Receive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/screens/job-details?id=${selected.jobId}`)}
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
  // Receipt
  receiptCard: { borderRadius: Radius.lg, padding: Spacing.xl, marginBottom: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  receiptTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  receiptSub: { fontSize: 12, marginTop: 2 },
  confirmReceiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginVertical: Spacing.sm,
  },
  confirmReceiveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  receiptDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: Spacing.md },
  receiptBody: { gap: 8 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rLabel: { fontSize: 13 },
  rValue: { fontSize: 13 },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  confirmedText: { fontSize: 14, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 },
  receiptTime: { textAlign: 'center', fontSize: 11 },
  receiptLine: { width: '80%', height: 1, backgroundColor: '#DDD', marginTop: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  rSub: { fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 4 },
  rDash: { textAlign: 'center', color: '#999', marginVertical: 4, fontSize: 12 },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
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
