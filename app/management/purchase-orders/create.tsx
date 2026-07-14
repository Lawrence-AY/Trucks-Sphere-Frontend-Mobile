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
      const vendor = vendors.find((v) => v.id === form.vendorId);
      const material = materials.find((m) => m.id === form.materialId);

      await purchaseOrderRepository.create({
        vendorId: form.vendorId,
        vendorName: vendor?.companyName || 'Unknown',
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
      const msg = err?.response?.data?.message || err?.message || 'Failed to create purchase order';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  const vendorOptions = vendors.map((v) => ({ id: v.id, name: v.companyName }));
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
});
