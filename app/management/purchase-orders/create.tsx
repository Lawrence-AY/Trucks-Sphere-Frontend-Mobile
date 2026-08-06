/** Purchase-order creation with a backend-owned number preview. */

import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from '../../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { purchaseOrderRepository } from '../../../services/repositories/PurchaseOrderRepository';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { materialRepository } from '../../../services/repositories/MaterialRepository';
import { Material, Vendor } from '../../../store/types';
import { fetchPurchaseOrders, previewPurchaseOrderNumber } from '../../../services/api';
import { showAlert } from '../../../utils/webAlert';

function displayNumber(value: unknown, prefix: string) {
  return String(value || '').replace(new RegExp(`^${prefix}`, 'i'), '') || '—';
}

export default function CreatePurchaseOrderScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [previewNumber, setPreviewNumber] = useState('');
  const [unit, setUnit] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ vendorId: '', materialId: '', quantity: '' });

  useEffect(() => { void loadOptions(); }, []);

  useEffect(() => {
    const material = materials.find((item) => item.id === form.materialId);
    setUnit(material?.defaultUnit || material?.measurementType || 'units');
  }, [form.materialId, materials]);

  useEffect(() => {
    let cancelled = false;
    if (!form.vendorId || !form.materialId) {
      setPreviewNumber('');
      return;
    }
    previewPurchaseOrderNumber(form.vendorId, form.materialId)
      .then((number) => { if (!cancelled) setPreviewNumber(number); })
      .catch(() => { if (!cancelled) setPreviewNumber(''); });
    return () => { cancelled = true; };
  }, [form.vendorId, form.materialId]);

  async function loadOptions() {
    try {
      const [vendorItems, materialItems] = await Promise.all([vendorRepository.getAll(), materialRepository.getAll()]);
      setVendors(vendorItems);
      setMaterials(materialItems);
    } catch {
      await showAlert('Unable to load form options', 'Check your connection and try again.');
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) {
      setErrors((previous) => {
        const updated = { ...previous };
        delete updated[field];
        return updated;
      });
    }
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    const selectedMaterial = materials.find((item) => item.id === form.materialId);
    const isWarehouseMaterial = Boolean(selectedMaterial?.isWarehouseMaterial);
    if (!form.vendorId) nextErrors.vendorId = 'Vendor is required';
    if (!form.materialId) nextErrors.materialId = 'Material is required';
    if (!isWarehouseMaterial && (!form.quantity || Number.isNaN(Number(form.quantity)) || Number(form.quantity) <= 0)) {
      nextErrors.quantity = 'Valid quantity is required';
    }
    if (isWarehouseMaterial && form.quantity && (Number.isNaN(Number(form.quantity)) || Number(form.quantity) < 0)) {
      nextErrors.quantity = 'Enter a valid quantity';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) {
      await showAlert('Missing required fields', 'Complete the vendor, material, and quantity fields before creating the order.');
      return;
    }

    setSaving(true);
    try {
      const existingOrders = await purchaseOrderRepository.getAll();
      const duplicate = existingOrders.find((order) =>
        order.vendorId === form.vendorId &&
        order.materialId === form.materialId &&
        !['completed', 'cancelled', 'archived'].includes(order.status) &&
        (order.quantityDelivered || 0) < (order.quantity || 0),
      );
      if (duplicate) {
        await showAlert('Duplicate purchase order', 'An active order already exists for this vendor and material. Edit the existing order or choose a different vendor or material.');
        return;
      }

      const vendor = vendors.find((item) => item.id === form.vendorId);
      const material = materials.find((item) => item.id === form.materialId);
      const vendorName = vendor?.companyName || (vendor as any)?.name || 'Unknown';
      const created = await purchaseOrderRepository.create({
        vendorId: form.vendorId,
        vendorNumber: displayNumber(vendor?.vendorId || vendor?.id, 'V'),
        vendorName,
        companyName: vendorName,
        materialId: form.materialId,
        materialNumber: displayNumber(material?.id, 'MAT'),
        materialName: material?.name || 'Unknown',
        quantity: form.quantity ? Number(form.quantity) : undefined,
        unit,
      });

      await showAlert('Purchase order created', `Purchase order ${created.poNumber} created successfully.`);
      setForm({ vendorId: '', materialId: '', quantity: '' });
      setErrors({});
      setPreviewNumber('');
      setUnit('');
      router.replace('/management/purchase-orders' as any);
    } catch (error: any) {
      const status = error?.response?.status;
      // A mobile client can lose the response after the backend has already
      // committed the order. Confirm the uniquely constrained vendor/material
      // pair before showing a failure so users do not submit it twice.
      if (!error?.response) {
        const confirmedOrders = await fetchPurchaseOrders();
        const confirmed = confirmedOrders.find((order: any) =>
          order.vendorId === form.vendorId && order.materialId === form.materialId,
        );
        if (confirmed) {
          await showAlert('Purchase order created', `Purchase order ${confirmed.poNumber || previewNumber} was created successfully.`);
          setForm({ vendorId: '', materialId: '', quantity: '' });
          setErrors({});
          setPreviewNumber('');
          setUnit('');
          router.replace('/management/purchase-orders' as any);
          return;
        }
      }
      const message = status === 409
        ? 'A matching purchase order already exists.'
        : status === 400
          ? 'Check the purchase-order fields and try again.'
          : !error?.response
            ? 'The order may have been created, but the response could not be confirmed. Check Purchase Orders before trying again.'
            : 'Unable to create the purchase order. Please try again.';
      await showAlert('Purchase order not created', message);
    } finally {
      setSaving(false);
    }
  }

  const vendorOptions = vendors.map((vendor) => ({
    id: vendor.id,
    name: `${displayNumber(vendor.vendorId || vendor.id, 'V')} - ${vendor.companyName || (vendor as any)?.name || 'Unknown Vendor'}`,
  }));
  const materialOptions = materials.map((material) => ({ id: material.id, name: `${displayNumber(material.id, 'MAT')} - ${material.name}` }));
  const selectedMaterial = materials.find((item) => item.id === form.materialId);
  const isWarehouseMaterial = Boolean(selectedMaterial?.isWarehouseMaterial);

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={22} color="#1E293B" /></TouchableOpacity>
        <Text style={styles.backTitle}>Create Purchase Order</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
         

        {(form.vendorId || form.materialId || form.quantity) ? (
          <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.previewHeader}><Ionicons name="eye-outline" size={16} color={colors.textMuted} /><Text style={[styles.previewTitle, { color: colors.textMuted }]}>Preview</Text></View>
            <PreviewField label="Purchase Order Number" value={previewNumber || 'Generated by the server'} color={colors.primary} emphasis />
            <PreviewField label="Vendor" value={vendorOptions.find((item) => item.id === form.vendorId)?.name || '—'} color={colors.text} />
            <PreviewField label="Material" value={materialOptions.find((item) => item.id === form.materialId)?.name || '—'} color={colors.text} />
            <PreviewField label="Quantity" value={form.quantity ? `${form.quantity} ${unit}` : '—'} color={colors.text} />
          </View>
        ) : (
          <View style={[styles.previewCard, styles.previewEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="document-text-outline" size={32} color={`${colors.textMuted}60`} />
            <Text style={[styles.previewEmptyText, { color: `${colors.textMuted}80` }]}>Fill in the form to see a preview of the purchase order</Text>
          </View>
        )}

        <Card>
          <Select label="Vendor" value={form.vendorId} options={vendorOptions} onSelect={(value) => updateField('vendorId', value)} icon="business-outline" required error={errors.vendorId} placeholder="Select vendor..." />
          <Select label="Material" value={form.materialId} options={materialOptions} onSelect={(value) => updateField('materialId', value)} icon="cube-outline" required error={errors.materialId} placeholder="Select material..." />
          <Input label={isWarehouseMaterial ? 'Quantity (optional)' : 'Quantity'} value={form.quantity} onChangeText={(value) => updateField('quantity', value)} placeholder={isWarehouseMaterial ? 'Optional' : 'e.g. 100'} icon="scale-outline" keyboardType="numeric" required={!isWarehouseMaterial} error={errors.quantity} suffix={unit} />
        </Card>
        <View style={styles.actions}>
          <Button title="Cancel" onPress={() => router.back()} variant="secondary" style={styles.actionBtn} />
          <Button title="Create PO" onPress={handleCreate} icon="checkmark-circle" style={styles.actionBtn} loading={saving} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PreviewField({ label, value, color, emphasis = false }: { label: string; value: string; color: string; emphasis?: boolean }) {
  return <View style={styles.previewField}><Text style={styles.previewLabel}>{label}</Text><Text style={[styles.previewValue, { color }, emphasis && styles.previewValueEmphasis]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 8, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginLeft: 4 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] + 24 },
  header: { marginBottom: Spacing.lg },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  actionBtn: { flex: 1 },
  previewCard: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
  previewEmptyText: { fontSize: 13, textAlign: 'center' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewField: { gap: 2 },
  previewLabel: { color: '#64748B', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewValue: { fontSize: 14, fontWeight: '600' },
  previewValueEmphasis: { fontSize: 15, fontWeight: '700' },
});
