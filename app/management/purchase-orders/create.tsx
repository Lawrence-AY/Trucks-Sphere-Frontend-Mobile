/**
 * Create Purchase Order Screen - Full form with vendor, material selection
 *
 * Features:
 *   - Select vendor (with search)
 *   - Select material (with dynamic units)
 *   - Enter quantity
 *   - Set expected completion date
 *   - Create with optimistic UI
 *   - PO auto-numbering
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { Vendor, Material } from '../../../store/types';

export default function CreatePurchaseOrderScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState({
    vendorId: '',
    materialId: '',
    quantity: '',
    expectedCompletion: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [unit, setUnit] = useState('');

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    const mat = materials.find((m) => m.id === form.materialId);
    setUnit(mat?.defaultUnit || mat?.measurementType || 'units');
  }, [form.materialId, materials]);

  async function loadOptions() {
    try {
      const [v, m] = await Promise.all([
        vendorRepository.getAll(),
        materialRepository.getAll(),
      ]);
      setVendors(v);
      setMaterials(m);
    } catch {
      // Silent
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.vendorId) newErrors.vendorId = 'Vendor is required';
    if (!form.materialId) newErrors.materialId = 'Material is required';
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
      newErrors.quantity = 'Valid quantity is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      // Check for duplicate active PO (same vendor + material, not yet fully delivered)
      const existingOrders = await purchaseOrderRepository.getAll();
      const duplicate = existingOrders.find(
        (po) =>
          po.vendorId === form.vendorId &&
          po.materialId === form.materialId &&
          po.status !== 'completed' &&
          po.status !== 'cancelled' &&
          po.status !== 'archived' &&
          (po.quantityDelivered || 0) < (po.quantity || 0)
      );

      if (duplicate) {
        Alert.alert(
          'Duplicate Order',
          `An active purchase order already exists for this vendor and material combination.\n\nPO: ${duplicate.poNumber || duplicate.id}\nDelivered: ${duplicate.quantityDelivered || 0}/${duplicate.quantity || 0} ${duplicate.unit || 'units'}\n\nPlease wait until the current order is fully delivered, or ask management to edit the existing order.`,
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      const vendor = vendors.find((v) => v.id === form.vendorId);
      const material = materials.find((m) => m.id === form.materialId);
      const vendorDisplayName = vendor?.companyName || (vendor as any)?.name || 'Unknown';

      await purchaseOrderRepository.create({
        vendorId: form.vendorId,
        vendorName: vendorDisplayName,
        companyName: vendorDisplayName,
        materialId: form.materialId,
        materialName: material?.name || 'Unknown',
        quantity: Number(form.quantity),
        unit: unit,
        expectedCompletion: form.expectedCompletion || undefined,
        notes: form.notes || undefined,
        status: 'draft',
      });

      Alert.alert('Success', 'Purchase order created successfully', [
        {
          text: 'View POs',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create purchase order';
      Alert.alert('Duplicate Order', msg);
    } finally {
      setSaving(false);
    }
  }

  const vendorOptions = vendors.map((v) => ({ id: v.id, name: v.companyName || (v as any).name || 'Unknown Vendor', subtitle: v.vendorId }));
  const materialOptions = materials.map((m) => ({ id: m.id, name: `${m.name} (${m.category})` }));

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Create Purchase Order</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create Purchase Order</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Create a new purchase order for materials
          </Text>
        </View>

        {/* Live Preview */}
        {(form.vendorId || form.materialId || form.quantity) ? (
          <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.previewHeader}>
              <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.previewTitle, { color: colors.textMuted }]}>Preview</Text>
            </View>
            <View style={styles.previewRow}>
              <View style={styles.previewField}>
                <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Company Name</Text>
                <Text style={[styles.previewValue, { color: colors.primary, fontSize: 15, fontWeight: '700' }]}>
                  {vendors.find((v) => v.id === form.vendorId)?.companyName || '—'}
                </Text>
              </View>
            </View>
            <View style={styles.previewRow}>
              <View style={styles.previewField}>
                <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Material</Text>
                <Text style={[styles.previewValue, { color: colors.text }]}>
                  {materialOptions.find((m) => m.id === form.materialId)?.name || '—'}
                </Text>
              </View>
            </View>
            <View style={styles.previewRow}>
              <View style={styles.previewField}>
                <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Quantity</Text>
                <Text style={[styles.previewValue, { color: colors.text }]}>
                  {form.quantity ? `${form.quantity} ${unit}` : '—'}
                </Text>
              </View>
              <View style={styles.previewField}>
                <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Expected</Text>
                <Text style={[styles.previewValue, { color: colors.text }]}>
                  {form.expectedCompletion || '—'}
                </Text>
              </View>
            </View>
            <View style={styles.previewStatus}>
              <View style={[styles.statusDot, { backgroundColor: '#94A3B8' }]} />
              <Text style={[styles.previewStatusText, { color: colors.textMuted }]}>Status: Draft</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.previewCard, styles.previewEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="document-text-outline" size={32} color={colors.textMuted + '60'} />
            <Text style={[styles.previewEmptyText, { color: colors.textMuted + '80' }]}>
              Fill in the form to see a preview of the purchase order
            </Text>
          </View>
        )}

        <Card>
          <Select
            label="Vendor"
            value={form.vendorId}
            options={vendorOptions}
            onSelect={(v) => updateField('vendorId', v)}
            icon="business-outline"
            required
            error={errors.vendorId}
            placeholder="Select vendor..."
          />

          <Select
            label="Material"
            value={form.materialId}
            options={materialOptions}
            onSelect={(v) => updateField('materialId', v)}
            icon="cube-outline"
            required
            error={errors.materialId}
            placeholder="Select material..."
          />

          <Input
            label="Quantity"
            value={form.quantity}
            onChangeText={(v) => updateField('quantity', v)}
            placeholder="e.g. 100"
            icon="scale-outline"
            keyboardType="numeric"
            required
            error={errors.quantity}
            suffix={unit}
          />

          <Input
            label="Expected Completion"
            value={form.expectedCompletion}
            onChangeText={(v) => updateField('expectedCompletion', v)}
            placeholder="e.g. 2024-12-31"
            icon="calendar-outline"
          />

          <Input
            label="Notes"
            value={form.notes}
            onChangeText={(v) => updateField('notes', v)}
            placeholder="Optional notes..."
            icon="document-text-outline"
            multiline
            numberOfLines={3}
          />
        </Card>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="secondary"
            style={styles.actionBtn}
          />
          <Button
            title="Create PO"
            onPress={handleCreate}
            icon="checkmark-circle"
            style={styles.actionBtn}
            loading={saving}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 4,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  previewEmptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  previewField: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewStatusText: {
    fontSize: 12,
  },
});
