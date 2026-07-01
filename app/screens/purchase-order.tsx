import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchPurchaseOrders, fetchDeliveryOrders, fetchVendors, fetchMaterials, fetchQuarries, fetchSites } from '../../services/api';
import { formatEAT, formatCurrency, formatStatus, getStatusColor } from '../../utils/helpers';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

function PORow({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <View style={styles.rRow}>
      <Text style={styles.rLabel}>{label}</Text>
      <Text style={[styles.rValue, bold && { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function PickerField({ label, value, options, onSelect, icon }: { label: string; value: string; options: { id: string; name: string }[]; onSelect: (id: string) => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.pickerBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setOpen(!open)}>
        {icon && <Ionicons name={icon} size={16} color={colors.textMuted} />}
        <Text style={[styles.pickerText, { color: selected ? colors.text : colors.textMuted }]}>{selected?.name || `Select ${label}...`}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 200 }}>
            {options.map(o => (
              <TouchableOpacity key={o.id} style={[styles.dropdownItem, o.id === value && { backgroundColor: (colors as any).accent + '15' }]} onPress={() => { onSelect(o.id); setOpen(false); }}>
                <Text style={{ color: colors.text, fontSize: 14 }}>{o.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function PurchaseOrderScreen() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new: string }>();
  const colors = useTheme();
  const { user } = useAuthStore();

  // ===== Create mode state =====
  const [createMode, setCreateMode] = useState(isNew === 'true');
  const [vendorId, setVendorId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [quarryId, setQuarryId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Reference data for pickers
  const [vendors, setVendors] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [quarries, setQuarries] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);

  // ===== View mode state =====
  const [searchPo, setSearchPo] = useState(id || '');
  const [order, setOrder] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load reference data for create mode
  useEffect(() => {
    if (createMode) {
      Promise.all([
        fetchVendors().then(setVendors),
        fetchMaterials().then(setMaterials),
        fetchQuarries().then(setQuarries),
        fetchSites().then(setSites),
      ]).catch(console.warn);
      setLoading(false);
    }
  }, [createMode]);

  // Load order by ID or PO number (view mode)
  const loadData = async (poIdOrNumber: string) => {
    if (!poIdOrNumber) return;
    setLoading(true);
    setError('');
    try {
      const orders = await fetchPurchaseOrders({ search: '' });
      const foundOrder = orders?.find(
        (o: any) =>
          o.id === poIdOrNumber ||
          o.poNumber === poIdOrNumber ||
          (o.poNumber || '').toLowerCase() === poIdOrNumber.toLowerCase()
      );
      if (foundOrder) {
        setOrder(foundOrder);
        const dos = await fetchDeliveryOrders({ purchaseOrderId: foundOrder.id });
        setDeliveries(dos || []);
      } else {
        setError(`No purchase order found for: ${poIdOrNumber}`);
        setOrder(null);
        setDeliveries([]);
      }
    } catch (e: any) {
      setError('Failed to load purchase order data');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!createMode && id) {
      setSearchPo(id);
      loadData(id);
    } else if (!createMode) {
      setLoading(false);
    }
  }, [id]);

  // ===== Create handler =====
  const handleCreate = async () => {
    if (!vendorId || !materialId || !quarryId || !siteId || !quantity) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    const selectedVendor = vendors.find(v => v.id === vendorId);
    const selectedMaterial = materials.find(m => m.id === materialId);
    const selectedQuarry = quarries.find(q => q.id === quarryId);
    const selectedSite = sites.find(s => s.id === siteId);
    const qty = Number(quantity);
    const unitPrice = selectedMaterial?.unitPrice || 0;

    const poNumber = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    setSaving(true);
    try {
      await api.post('/api/purchase-orders', {
        poNumber,
        vendorId,
        vendorName: selectedVendor?.name || '',
        materialId,
        materialName: selectedMaterial?.name || '',
        quantity: qty,
        unit: selectedMaterial?.unit || 'tonnes',
        unitPrice,
        totalAmount: qty * unitPrice,
        status: 'pending',
        quarryId,
        quarryName: selectedQuarry?.name || '',
        siteId,
        siteName: selectedSite?.name || '',
        requestedBy: user?.uid || 'u1',
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('Success', `Purchase order ${poNumber} created!`, [
        { text: 'View Orders', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to create purchase order');
    }
    setSaving(false);
  };

  // ===== Create Mode Screen =====
  if (createMode) {
    const selectedVendor = vendors.find(v => v.id === vendorId);
    const selectedMaterial = materials.find(m => m.id === materialId);
    const qty = Number(quantity) || 0;
    const unitPrice = selectedMaterial?.unitPrice || 0;
    const total = qty * unitPrice;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.createHeader}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.createTitle, { color: colors.text }]}>New Purchase Order</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PickerField label="Vendor" value={vendorId} options={vendors.map(v => ({ id: v.id, name: v.name }))} onSelect={setVendorId} icon="business-outline" />
            <PickerField label="Material" value={materialId} options={materials.map(m => ({ id: m.id, name: `${m.name} (${formatCurrency(m.unitPrice)}/${m.unit})` }))} onSelect={setMaterialId} icon="cube-outline" />
            <PickerField label="Quarry (Origin)" value={quarryId} options={quarries.map(q => ({ id: q.id, name: q.name }))} onSelect={setQuarryId} icon="home-outline" />
            <PickerField label="Site (Destination)" value={siteId} options={sites.map(s => ({ id: s.id, name: s.name }))} onSelect={setSiteId} icon="flag-outline" />

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Quantity</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Ionicons name="resize-outline" size={16} color={colors.textMuted} />
                <TextInput style={[styles.inputField, { color: colors.text }]} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="e.g. 200" placeholderTextColor={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>{selectedMaterial?.unit || 'units'}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Notes (optional)</Text>
              <TextInput style={[styles.inputField, styles.notesField, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} value={notes} onChangeText={setNotes} placeholder="Any special instructions..." placeholderTextColor={colors.textMuted} multiline numberOfLines={2} />
            </View>

            {/* Preview card */}
            <View style={[styles.preview, { borderColor: colors.accent, backgroundColor: (colors as any).accent + '08' }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent, marginBottom: Spacing.sm }}>ORDER PREVIEW</Text>
              <PORow label="Vendor" value={selectedVendor?.name || '—'} />
              <PORow label="Material" value={selectedMaterial?.name || '—'} />
              <PORow label="Quantity" value={qty ? `${qty} ${selectedMaterial?.unit || ''}` : '—'} bold />
              <PORow label="Unit Price" value={formatCurrency(unitPrice)} />
              <PORow label="Total" value={formatCurrency(total)} bold />
            </View>

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
              <Text style={styles.submitBtnText}>{saving ? 'Creating...' : 'Create Purchase Order'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ===== View Mode Screen (original) =====
  const completedTrips = deliveries.filter(d => d.status === 'delivered').length;
  const totalDeliveredQty = deliveries.reduce((sum, d) => sum + (d.quantityDelivered || 0), 0);
  const remainingQty = Math.max(0, (order?.quantity || 0) - totalDeliveredQty);
  const progressPct = order?.quantity ? Math.min(100, (totalDeliveredQty / order.quantity) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search PO (e.g. PO-2026-001)"
            placeholderTextColor={colors.textMuted}
            value={searchPo}
            onChangeText={setSearchPo}
            onSubmitEditing={() => loadData(searchPo.trim())}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => loadData(searchPo.trim())}>
            <Ionicons name="arrow-forward-circle" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: Spacing.md }}>Loading...</Text>
          </View>
        )}

        {Boolean(error) && !loading && (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
            <Text style={{ fontSize: 14, color: colors.danger, textAlign: 'center', marginTop: Spacing.md }}>{error}</Text>
          </View>
        )}

        {!loading && order && (
          <>
            <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.receiptHeader}>
                <Ionicons name="document-text" size={28} color={colors.primary} />
                <Text style={[styles.receiptTitle, { color: colors.text }]}>PURCHASE ORDER</Text>
              </View>
              <View style={styles.receiptBody}>
                <Text style={[styles.rHead, { color: colors.text }]}>{order.poNumber}</Text>
                <PORow label="Vendor" value={order.vendorName} />
                <PORow label="Material" value={order.materialName} />
                <PORow label="Quantity" value={`${order.quantity} ${order.unit}`} bold />
                <PORow label="Unit Price" value={formatCurrency(order.unitPrice)} />
                <PORow label="Total" value={formatCurrency(order.totalAmount)} bold />
                <PORow label="Quarry" value={order.quarryName} />
                <PORow label="Destination" value={order.siteName} />
                <PORow label="Created" value={formatEAT(order.createdAt)} />
                <View style={[styles.stamp, { backgroundColor: getStatusColor(order.status) + '15', borderColor: getStatusColor(order.status) }]}>
                  <Text style={[styles.stampText, { color: getStatusColor(order.status) }]}>{formatStatus(order.status).toUpperCase()}</Text>
                </View>
              </View>
            </View>

            {deliveries.length > 0 && (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: Spacing.sm }}>Linked Trips ({deliveries.length})</Text>
                {deliveries.map((d, i) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => router.push(`/screens/job-details?id=${d.jobId}` as any)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.accent }}>#{i + 1} · {d.jobId}</Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: getStatusColor(d.status) + '15' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: getStatusColor(d.status) }}>{formatStatus(d.status)}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{d.driverName} · {d.plateNumber}</Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{d.materialName} · {d.quantityDelivered || 0} {order.unit}</Text>
                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 2 }}>{formatEAT(d.createdAt)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.accent }]}
              onPress={async () => {
                if (!order) return;
                await Share.share({
                  message: `PO #${order.poNumber}\nVendor: ${order.vendorName}\nMaterial: ${order.materialName}\nQty: ${order.quantity} ${order.unit}\nTotal: ${formatCurrency(order.totalAmount)}\nStatus: ${formatStatus(order.status)}`,
                  title: 'Purchase Order'
                });
              }}
            >
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Share</Text>
            </TouchableOpacity>
          </>
        )}

        {!loading && !order && !error && (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.md }}>Enter a Purchase Order number above</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: Spacing['4xl'] },
  createHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  createTitle: { fontSize: 20, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 46, gap: Spacing.sm, marginBottom: Spacing.md },
  searchInput: { flex: 1, fontSize: 14 },
  center: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  receipt: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.md },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptTitle: { fontSize: 16, fontWeight: '700', color: '#333', letterSpacing: 1, marginTop: 4 },
  receiptBody: { padding: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', color: '#333', textAlign: 'center' },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rLabel: { fontSize: 14, color: '#666' },
  rValue: { fontSize: 14, color: '#333' },
  stamp: { alignItems: 'center', paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginVertical: 8 },
  stampText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, gap: Spacing.sm, marginTop: Spacing.sm },
  // Create mode styles
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  pickerText: { flex: 1, fontSize: 14 },
  dropdown: { borderWidth: 1, borderRadius: Radius.md, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: Spacing.md },
  inputWrap: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  inputField: { flex: 1, fontSize: 14, height: 44 },
  notesField: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, height: 60, textAlignVertical: 'top' },
  preview: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: Radius.md, gap: Spacing.sm },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});