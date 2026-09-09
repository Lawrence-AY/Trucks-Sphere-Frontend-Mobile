import { ResponsiveGrid } from '../../../components/ResponsiveGrid';
/**
 * Create Material Screen - With dynamic property definitions
 *
 * Features:
 *   - Select category
 *   - Select measurement type
 *   - Define dynamic properties (name, type, options)
 *   - Auto-suggest properties based on category
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from '../../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { materialRepository } from '../../../services/repositories/MaterialRepository';
import { showAlertWithCallback } from '../../../utils/webAlert';
import { MaterialCategory, MeasurementUnit, MaterialProperty } from '../../../store/types';

const CATEGORIES: { id: MaterialCategory; name: string }[] = [
  { id: 'Aggregates', name: 'Aggregates' },
  { id: 'Steel', name: 'Steel' },
  { id: 'Cement', name: 'Cement' },
  { id: 'Liquid', name: 'Liquid' },
  { id: 'Blocks', name: 'Blocks' },
 
];

const MEASUREMENT_UNITS: { id: MeasurementUnit; name: string }[] = [
  { id: 'Tonnes', name: 'Tonnes' },
  { id: 'Bags', name: 'Bags' },
  { id: 'Pieces', name: 'Pieces' },
  { id: 'Millimetres', name: 'Millimetres' },
  { id: 'Metres', name: 'Metres' },
  { id: 'Litres', name: 'Litres' },
  { id: 'Cubic Metres', name: 'Cubic Metres' },
  { id: 'Kilograms', name: 'Kilograms' },
];

const PROPERTY_TYPES = [
  { id: 'text', name: 'Text' },
  { id: 'number', name: 'Number' },
  { id: 'select', name: 'Select (Dropdown)' },
  { id: 'boolean', name: 'Boolean (Yes/No)' },
];

export default function CreateMaterialScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: '' as string,
    measurementType: '' as string,
    description: '',
    unitPrice: '',
    salesPrice: '',
    barcode: '',
    isWarehouseMaterial: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<MaterialProperty[]>([]);

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

  function addProperty() {
    setProperties((prev) => [
      ...prev,
      { name: '', label: '', type: 'text', required: false, options: [] },
    ]);
  }

  function updateProperty(index: number, field: string, value: any) {
    setProperties((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function removeProperty(index: number) {
    setProperties((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Material name is required';
    if (!form.isWarehouseMaterial && !form.category) newErrors.category = 'Category is required';
    for (const field of ['unitPrice', 'salesPrice'] as const) {
      if (!form.isWarehouseMaterial && form[field].trim() && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) {
        newErrors[field] = 'Enter a valid non-negative number';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      await materialRepository.create({
        name: form.name.trim(),
        ...(!form.isWarehouseMaterial ? {
        category: form.category as MaterialCategory,
        ...(form.measurementType ? { measurementType: form.measurementType as MeasurementUnit } : {}),
        description: form.description.trim() || undefined,
        unitPrice: form.unitPrice.trim() ? Number(form.unitPrice) : undefined,
        salesPrice: form.salesPrice.trim() ? Number(form.salesPrice) : undefined,
        properties: properties.length > 0 ? properties : undefined,
        } : {}),
        isWarehouseMaterial: form.isWarehouseMaterial,
        status: 'active',
      });

      materialRepository.invalidateCache();
      setForm({
        name: '', category: '', measurementType: '',
        description: '', unitPrice: '', salesPrice: '', barcode: '',
        isWarehouseMaterial: false,
      });
      setProperties([]);
      setErrors({});
      await showAlertWithCallback('Material created', 'Material created successfully.', () => router.back());
    } catch (err: any) {
      const errorCode = String(err?.code || '').toUpperCase();
      const isRequestTimeout = errorCode === 'NETWORK_TIMEOUT' || errorCode === 'ECONNABORTED';
      const msg = isRequestTimeout
        ? 'The server is still confirming this material. It may already have been created. Go back and refresh the Materials list before trying again to avoid a duplicate.'
        : err?.response?.data?.message || err?.message || 'Failed to create material';
      await showAlertWithCallback('Unable to create material', msg, () => {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back Button */}
      <View style={[styles.backBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={[styles.backTitle, { color: colors.text }]}>Create Material</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        

        <Card>
          <Input
            label="Material Name"
            value={form.name}
            onChangeText={(v) => updateField('name', v)}
            placeholder="e.g. Ballast 3/4"
            icon="cube-outline"
            required
            error={errors.name}
          />

          <View style={[styles.warehouseOption, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.warehouseOptionTitle, { color: colors.text }]}>Warehouse reference material</Text>
              <Text style={[styles.warehouseOptionText, { color: colors.textMuted }]}>Use this custom MAT as the fixed reference for warehouse jobs.</Text>
            </View>
            <Switch
              value={form.isWarehouseMaterial}
              onValueChange={(value) => {
                setForm((prev) => ({ ...prev, isWarehouseMaterial: value }));
                setErrors({});
              }}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={form.isWarehouseMaterial ? colors.primary : colors.surface}
            />
          </View>

          {!form.isWarehouseMaterial && <>
          <Select
            label="Category"
            value={form.category}
            options={CATEGORIES}
            onSelect={(v) => updateField('category', v)}
            icon="layers-outline"
            required
            error={errors.category}
            placeholder="Select category..."
          />

          <Select
            label="Measurement Type"
            value={form.measurementType}
            options={MEASUREMENT_UNITS}
            onSelect={(v) => updateField('measurementType', v)}
            icon="speedometer-outline"
            error={errors.measurementType}
            placeholder="Select measurement (optional)..."
          />

          <Input
            label="Description"
            value={form.description}
            onChangeText={(v) => updateField('description', v)}
            placeholder="Optional description..."
            icon="document-text-outline"
            multiline
            numberOfLines={3}
          />
          <Input
            label="Purchase Cost (KES)"
            value={form.unitPrice}
            onChangeText={(v) => updateField('unitPrice', v)}
            placeholder="Optional cost per unit"
            icon="cash-outline"
            keyboardType="numeric"
            error={errors.unitPrice}
          />
          <Input
            label="Sales Price (KES)"
            value={form.salesPrice}
            onChangeText={(v) => updateField('salesPrice', v)}
            placeholder="Optional selling price per unit"
            icon="pricetag-outline"
            keyboardType="numeric"
            error={errors.salesPrice}
          />

          </>}
        </Card>

        {/* Dynamic Properties */}
        {!form.isWarehouseMaterial && <View style={styles.propertiesSection}>
          <View style={styles.propertiesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Properties</Text>
            <TouchableOpacity onPress={addProperty} style={styles.addPropBtn}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primaryText} />
              <Text style={[styles.addPropText, { color: colors.primaryText }]}>Add Property</Text>
            </TouchableOpacity>
          </View>

          {properties.length === 0 ? (
            <Text style={[styles.noProps, { color: colors.textMuted }]}>
              No custom properties defined. Properties will be auto-suggested based on category.
            </Text>
          ) : (
            properties.map((prop, index) => (
              <Card key={index}>
                <View style={styles.propRow}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Property Name"
                      value={prop.name}
                      onChangeText={(v) => updateProperty(index, 'name', v)}
                      placeholder="e.g. diameter"
                    />
                  </View>
                  <TouchableOpacity onPress={() => removeProperty(index)} style={styles.removeProp}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <ResponsiveGrid minItemWidth={280} maxColumns={2}>
<Select
                  label="Type"
                  value={prop.type}
                  options={PROPERTY_TYPES}
                  onSelect={(v) => updateProperty(index, 'type', v)}
                  icon="options-outline"
                />

                <Input
                  label="Display Label"
                  value={prop.label}
                  onChangeText={(v) => updateProperty(index, 'label', v)}
                  placeholder="e.g. Diameter"
                />
</ResponsiveGrid>
                {prop.type === 'select' && (
                  <Input
                    label="Options (comma separated)"
                    value={prop.options?.join(', ') || ''}
                    onChangeText={(v) => updateProperty(index, 'options', v.split(',').map((s) => s.trim()))}
                    placeholder="e.g. 8mm, 10mm, 12mm"
                  />
                )}
              </Card>
            ))
          )}
        </View>

        }
        <View style={styles.actions}>
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="secondary"
            style={styles.actionBtn}
          />
          <Button
            title="Create Material"
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
  header: { marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14, marginTop: Spacing.xs,
  },
  propertiesSection: { marginTop: Spacing.xs,
  },
  warehouseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md, marginBottom: Spacing.xs,
  },
  warehouseOptionTitle: { fontSize: 14, fontWeight: '700' },
  warehouseOptionText: { fontSize: 12, lineHeight: 17, marginTop: Spacing.xs},
  propertiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addPropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPropText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noProps: {
    fontSize: 13,
    fontStyle: 'italic',
    padding: Spacing.md,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  removeProp: {
    padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md, marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
