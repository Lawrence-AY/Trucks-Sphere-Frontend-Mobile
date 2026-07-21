/**
 * Edit Purchase Order Screen - Update PO details
 *
 * Features:
 *   - Pre-populated form with existing data
 *   - Update PO fields (only when in Draft status)
 *   - Validation
 *   - Audit logging
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing, Radius } from '../../../../constants/theme';
import { Card } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Button } from '../../../../components/ui/Button';
import { LoadingSkeleton } from '../../../../components/ui/LoadingSkeleton';
import { purchaseOrderRepository } from '../../../../services/repositories/PurchaseOrderRepository';
import { vendorRepository } from '../../../../services/repositories/VendorRepository';
import { materialRepository } from '../../../../services/repositories/MaterialRepository';
import { PurchaseOrder, Vendor, Material } from '../../../../store/types';

export default function EditPurchaseOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendorId: '',
    materialId: '',
    quantity: '',
    unit: 'Tonnes',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      const [p, v, m] = await Promise.all([
        purchaseOrderRepository.getById(id!),
        vendorRepository.getAll(),
        materialRepository.getAll(),
      ]);
      if (!p) {
        Alert.alert('Error', 'Purchase order not found');
        router.back();
        return;
      }
      setPo(p);
      setVendors(v);
      setMaterials(m);
      setForm({
        vendorId: p.vendorId || '',
        materialId: p.materialId || '',
        quantity: String(p.quantity || ''),
        unit: p.unit || 'Tonnes',
      });
    } catch {
      Alert.alert('Error', 'Failed to load purchase order');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'vendorId') {
      setForm((prev) => ({ ...prev, materialId: '' }));
    }
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
    if (!form.unit) newErrors.unit = 'Unit is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const selectedVendor = vendors.find((v) => v.id === form.vendorId);
      const selectedMaterial = materials.find((m) => m.id === form.materialId);

      await purchaseOrderRepository.update(id!, {
        vendorId: form.vendorId,
        vendorNumber: String(selectedVendor?.vendorId || selectedVendor?.id || '').replace(/^V/i, ''),
        vendorName: selectedVendor?.companyName || (selectedVendor as any)?.name || '',
        materialId: form.materialId,
        materialNumber: String(selectedMaterial?.id || '').replace(/^MAT/i, ''),
        materialName: selectedMaterial?.name || '',
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert('Saved', 'Purchase order updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update purchase order');
    } finally {
      setSaving(false);
    }
  }

  const filteredMaterials = materials.filter(
    (m) => m.status === 'active'
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSkeleton lines={8} variant="card" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Edit Purchase Order</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Update {po?.poNumber || 'purchase order'}
          </Text>
        </View>

        <Card>
          <Select
            label="Vendor"
            value={form.vendorId}
            options={vendors.map((v) => ({ id: v.id, name: `${String(v.vendorId || v.id).replace(/^V/i, '')} - ${v.companyName || (v as any).name || 'Unknown Vendor'}` }))}
            onSelect={(v) => updateField('vendorId', v)}
            icon="business-outline"
            required
            error={errors.vendorId}
            placeholder="Select vendor..."
          />

          {po?.status === 'draft' ? (
            <Select
              label="Material"
              value={form.materialId}
              options={filteredMaterials.map((m) => ({
                id: m.id,
                name: `${String(m.id).replace(/^MAT/i, '')} - ${m.name}`,
              }))}
              onSelect={(v) => updateField('materialId', v)}
              icon="cube-outline"
              required
              error={errors.materialId}
              placeholder={form.vendorId ? 'Select material...' : 'Select vendor first...'}
            />
          ) : (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4 }}>
                Material *
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 16, gap: 8, borderColor: colors.border, backgroundColor: colors.surface }}>
                <Ionicons name="cube-outline" size={18} color={colors.textMuted} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>
                  {po?.materialName || 'N/A'}
                </Text>
              </View>
            </View>
          )}

          <Input
            label="Quantity"
            value={form.quantity}
            onChangeText={(v) => updateField('quantity', v)}
            placeholder="e.g. 100"
            icon="scale-outline"
            keyboardType="numeric"
            required
            error={errors.quantity}
            suffix={form.unit}
          />

          <Select
            label="Unit"
            value={form.unit}
            options={[
              { id: 'Tonnes', name: 'Tonnes' },
              { id: 'Bags', name: 'Bags' },
              { id: 'Pieces', name: 'Pieces' },
              { id: 'Litres', name: 'Litres' },
              { id: 'Cubic Metres', name: 'Cubic Metres' },
              { id: 'Kilograms', name: 'Kilograms' },
            ]}
            onSelect={(v) => updateField('unit', v)}
            icon="speedometer-outline"
            required
            error={errors.unit}
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
            title="Save Changes"
            onPress={handleSave}
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
    marginTop: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
  },
});
