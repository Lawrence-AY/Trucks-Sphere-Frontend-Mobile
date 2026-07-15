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
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { materialRepository } from '../../../services/repositories/MaterialRepository';
import { MaterialCategory, MeasurementUnit, MaterialProperty } from '../../../store/types';

const CATEGORIES: { id: MaterialCategory; name: string }[] = [
  { id: 'Aggregates', name: 'Aggregates' },
  { id: 'Steel', name: 'Steel' },
  { id: 'Cement', name: 'Cement' },
  { id: 'Liquid', name: 'Liquid' },
  { id: 'Blocks', name: 'Blocks' },
  { id: 'Other', name: 'Other' },
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
    defaultUnit: '',
    description: '',
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
    if (!form.category) newErrors.category = 'Category is required';
    if (!form.measurementType) newErrors.measurementType = 'Measurement type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      await materialRepository.create({
        name: form.name.trim(),
        category: form.category as MaterialCategory,
        measurementType: form.measurementType as MeasurementUnit,
        defaultUnit: form.defaultUnit.trim() || undefined,
        description: form.description.trim() || undefined,
        properties: properties.length > 0 ? properties : undefined,
        status: 'active',
      });

      Alert.alert('Success', 'Material created successfully', [
        {
          text: 'View Materials',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create material';
      Alert.alert('Error', msg);
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
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Create Material</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create Material</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Add a new material to the system
          </Text>
        </View>

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
            required
            error={errors.measurementType}
            placeholder="Select measurement..."
          />

          <Input
            label="Default Unit"
            value={form.defaultUnit}
            onChangeText={(v) => updateField('defaultUnit', v)}
            placeholder="e.g. Tonnes, Bags, Pieces"
            icon="checkmark-outline"
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
        </Card>

        {/* Dynamic Properties */}
        <View style={styles.propertiesSection}>
          <View style={styles.propertiesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Properties</Text>
            <TouchableOpacity onPress={addProperty} style={styles.addPropBtn}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.addPropText, { color: colors.primary }]}>Add Property</Text>
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
  propertiesSection: {
    marginTop: Spacing.lg,
  },
  propertiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
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
