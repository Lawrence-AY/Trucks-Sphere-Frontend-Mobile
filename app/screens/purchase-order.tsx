import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { fetchPurchaseOrders, fetchDeliveryOrders, fetchVendors, fetchMaterials } from '../../services/api';
import { formatEAT, generatePONumber } from '../../utils/helpers';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

function PORow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.rRow}>
      <Text style={styles.rLabel}>{label}</Text>
      <Text style={[styles.rValue, bold && { fontWeight: '700' }]} numberOfLines={3}>{value}</Text>
    </View>
  );
}

function ModalPicker({ label, value, options, onSelect, icon }: { label: string; value: string; options: { id: string; name: string }[]; onSelect: (id: string) => void; icon?: string }) {
  const colors = useTheme();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find(function (o) { return o.id === value; });
  const filtered = search.trim()
    ? options.filter(function (o) { return o.name.toLowerCase().includes(search.toLowerCase()); })
    : options;

  return (
    <>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        <TouchableOpacity
          style={[styles.pickerBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => { setVisible(true); setSearch(''); }}
        >
          {icon && <Ionicons name={icon as any} size={16} color={colors.textMuted} />}
          <Text style={[styles.pickerText, { color: selected ? colors.text : colors.textMuted }]} numberOfLines={1}>{selected ? selected.name : 'Select ' + label + '...'}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Modal visible={visible} animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select {label}</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={[styles.modalSearch, { borderBottomColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput style={[styles.modalSearchInput, { color: colors.text }]} placeholder="Search..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} autoFocus />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item.id === value && { backgroundColor: colors.accent + '15' }]}
                onPress={() => { onSelect(item.id); setVisible(false); }}
              >
                <Text style={{ color: colors.text, fontSize: 16, flex: 1 }} numberOfLines={2}>{item.name}</Text>
                {item.id === value && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, fontSize: 14, padding: 20, textAlign: 'center' }}>No matches</Text>
            }
          />
        </View>
      </Modal>
    </>
  );
}

export default function PurchaseOrderScreen() {
  var params = useLocalSearchParams();
  var id = params.id;
  var isNew = params.new;
  var colors = useTheme();
  var auth = useAuthStore();
  var user = auth.user;

  var createModeState = useState(isNew === 'true');
  var createMode = createModeState[0];
  var setCreateMode = createModeState[1];
  var materialIdState = useState('');
  var materialId = materialIdState[0];
  var setMaterialId = materialIdState[1];
  var vendorIdState = useState('');
  var vendorId = vendorIdState[0];
  var setVendorId = vendorIdState[1];
  var quantityState = useState('');
  var quantity = quantityState[0];
  var setQuantity = quantityState[1];
  var savingState = useState(false);
  var saving = savingState[0];
  var setSaving = savingState[1];

  var vendorsState = useState<any[]>([]);
  var vendors = vendorsState[0];
  var setVendors = vendorsState[1];
  var materialsState = useState<any[]>([]);
  var materials = materialsState[0];
  var setMaterials = materialsState[1];

  var searchPoState = useState(typeof id === 'string' ? id : '');
  var searchPo = searchPoState[0];
  var setSearchPo = searchPoState[1];
  var orderState = useState<any>(null);
  var order = orderState[0];
  var setOrder = orderState[1];
  var deliveriesState = useState<any[]>([]);
  var deliveries = deliveriesState[0];
  var setDeliveries = deliveriesState[1];
  var loadingState = useState(true);
  var loading = loadingState[0];
  var setLoading = loadingState[1];
  var errorState = useState('');
  var error = errorState[0];
  var setError = errorState[1];

  // Normalize ID helpers for display
  function formatVendorId(raw: string) {
    if (!raw) return '';
    const match = String(raw).match(/^([Vv]?)(\d+)$/);
    if (match) return 'V' + String(parseInt(match[2], 10)).padStart(3, '0');
    return raw.toUpperCase();
  }
  function formatMaterialId(raw: string) {
    if (!raw) return '';
    const match = String(raw).match(/^([Mm]?(?:at)?)(\d+)$/i);
    if (match) return 'MAT' + String(parseInt(match[2], 10)).padStart(3, '0');
    return raw.toUpperCase();
  }

  var [poPreview, setPoPreview] = useState('');

  useEffect(function () {
    if (createMode) {
      fetchMaterials().then(function (m) {
        setMaterials(m || []);
        if (m.length > 0 && !materialId) setMaterialId(m[0].id);
      }).catch(function () {});
      fetchVendors().then(function (v) { setVendors(v || []); }).catch(function () {});
      setLoading(false);
    }
  }, [createMode]);

  // Compute live PO number preview locally — same formula as backend
  useEffect(function () {
    if (createMode && vendorId && materialId) {
      const matNum = formatMaterialId(materialId).replace('MAT', 'POMAT');
      const vendNum = formatVendorId(vendorId);
      setPoPreview(vendNum ? `${matNum}/${vendNum}` : matNum);
    } else {
      setPoPreview('');
    }
  }, [vendorId, materialId, createMode]);

  function loadData(poIdOrNumber: string) {
    if (!poIdOrNumber) return;
    setLoading(true);
    setError('');
    fetchPurchaseOrders({ search: '' }).then(function (orders) {
      var found = (orders || []).find(function (o) { return o.id === poIdOrNumber || o.poNumber === poIdOrNumber; });
      if (found) {
        setOrder(found);
        fetchDeliveryOrders({ purchaseOrderId: found.id }).then(function (dos) { setDeliveries(dos || []); });
      } else {
        setError('No purchase order found for: ' + poIdOrNumber);
      }
      setLoading(false);
    }).catch(function () { setError('Failed to load'); setLoading(false); });
  }

  useEffect(function () {
    if (!createMode && id) { setSearchPo(id as string); loadData(id as string); }
    else if (!createMode) setLoading(false);
  }, [id]);

  function handleCreate() {
    if (!materialId || !vendorId || !quantity) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    var selectedMaterial = materials.find(function (m) { return m.id === materialId; });
    var selectedVendor = vendors.find(function (v) { return v.id === vendorId; });
    var qty = Number(quantity);
    setSaving(true);
    api.post('/api/purchase-orders', {
      materialId: materialId,
      materialName: selectedMaterial ? selectedMaterial.name || '' : '',
      vendorId: vendorId,
      vendorName: selectedVendor ? selectedVendor.companyName || selectedVendor.name || '' : '',
      quantity: qty,
      unit: selectedMaterial ? selectedMaterial.unit || 'tons' : 'tons',
      status: 'pending',
      requestedBy: user ? user.uid || 'u1' : 'u1',
    }).then(function (res: any) {
      const newPoNumber = res?.data?.poNumber || res?.poNumber || 'POMAT###';
      Alert.alert('Success', 'Purchase Order ' + newPoNumber + ' created!', [
        { text: 'OK', onPress: function () { router.back(); } },
      ]);
    }).catch(function (err: any) {
      var msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to create purchase order';
      Alert.alert('Duplicate Order', msg);
    })
      .finally(function () { setSaving(false); });
  }

  if (createMode) {
    var selectedMaterial2 = materials.find(function (m) { return m.id === materialId; });
    var selectedVendor2 = vendors.find(function (v) { return v.id === vendorId; });
    var qty2 = Number(quantity) || 0;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={styles.content}>
         
          <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ModalPicker label="Material" value={materialId} options={materials.map(function (m) { return { id: m.id, name: (m.name || m.id) + ' (' + formatMaterialId(m.id) + ')' }; })} onSelect={setMaterialId} icon="cube-outline" />
            <ModalPicker label="Vendor" value={vendorId} options={vendors.map(function (v) { return { id: v.id, name: (v.companyName || v.name || v.id) + ' (' + formatVendorId(v.id) + ')' }; })} onSelect={setVendorId} icon="business-outline" />

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Quantity</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Ionicons name="resize-outline" size={16} color={colors.textMuted} />
                <TextInput style={[styles.inputField, { color: colors.text }]} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="e.g. 200" placeholderTextColor={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>{selectedMaterial2 ? selectedMaterial2.unit || 'tons' : 'tons'}</Text>
              </View>
            </View>

            {materialId && vendorId ? (
              <View style={[styles.poPreview, { backgroundColor: colors.accent + '12', borderColor: colors.accent }]}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>PURCHASE ORDER NUMBER</Text>
                {poPreview ? (
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.accent }}>{poPreview}</Text>
                ) : (
                  <ActivityIndicator size="small" color={colors.accent} />
                )}
               </View>
            ) : null}

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#FFF" />}
              <Text style={styles.submitBtnText}>{saving ? 'Creating...' : 'Create Purchase Order'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {loading && <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>}
        {error && !loading && <View style={styles.center}><Ionicons name="alert-circle-outline" size={48} color={colors.danger} /><Text style={{ fontSize: 14, color: colors.danger, textAlign: 'center', marginTop: Spacing.md }}>{error}</Text></View>}
        {!loading && order && (
          <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.receiptHeader}><Ionicons name="document-text" size={28} color={colors.primary} /><Text style={[styles.receiptTitle, { color: colors.text }]}>PURCHASE ORDER</Text></View>
            <View style={styles.receiptBody}>
              <Text style={[styles.rHead, { color: colors.text }]}>{order.poNumber}</Text>
              <PORow label="Material" value={order.materialName} />
              <PORow label="Vendor" value={order.vendorName} />
              <PORow label="Quantity" value={order.quantity + ' ' + order.unit} bold />
              <PORow label="Created At" value={order.createdAt ? formatEAT(order.createdAt) : '-'} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

var styles = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: Spacing['4xl'] },
  createHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  createTitle: { fontSize: 20, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 46, gap: Spacing.sm, marginBottom: Spacing.md },
  searchInput: { flex: 1, fontSize: 14 },
  center: { alignItems: 'center', paddingVertical: Spacing['4xl'] },
  receipt: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.md },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md },
  receiptTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  receiptBody: { padding: Spacing.sm },
  rHead: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 3, gap: Spacing.sm },
  rLabel: { fontSize: 14, color: '#666', flexShrink: 0, marginTop: 1 },
  rValue: { fontSize: 14, color: '#333', flex: 1, textAlign: 'right', flexWrap: 'wrap' },
  stamp: { alignItems: 'center', paddingVertical: 8, borderRadius: 6, borderWidth: 1, marginVertical: 8 },
  stampText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  pickerText: { flex: 1, fontSize: 14 },
  poPreview: { borderRadius: Radius.md, borderWidth: 1.5, padding: Spacing.md, marginBottom: Spacing.md, alignItems: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  inputField: { flex: 1, fontSize: 14, height: 44 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: Radius.md, gap: Spacing.sm },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, paddingTop: Spacing['2xl'] },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSearch: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm },
  modalSearchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
});