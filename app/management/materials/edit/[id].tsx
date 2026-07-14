/**
 * Edit Material Screen - Update material details
 *
 * Features:
 *   - Pre-populated form with existing data
 *   - Update material fields
 *   - Dynamic properties based on category
 *   - Validation
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
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing, Radius } from '../../../../constants/theme';
import { Card } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Button } from '../../../../components/ui/Button';
import { LoadingSkeleton } from '../../../../components/ui/LoadingSkeleton';
import { materialRepository } from '../../../../services/repositories/MaterialRepository';
import { Material, MaterialCategory, MeasurementUnit } from '../../../../store/types';

const CATEGORIES: { id: MaterialCategory; name: string }[] = [
  { id: 'Aggregates', name: 'Aggregates' },
  { id: 'Steel', name: 'Steel' },
  { id: 'Cement', name: 'Cement' },
  { id: 'Liquid', name: 'Liquid' },
  { id: 'Blocks', name: 'Blocks' },
  { id: 'Other', name: 'Other' },
];

const UNITS: { id: MeasurementUnit; name: string }[] = [
  { id: 'Tonnes', name: 'Tonnes' },
  { id: 'Bags', name: 'Bags' },
  { id: 'Pieces', name: 'Pieces' },
  { id: 'Millimetres', name: 'Millimetres' },
  { id: 'Metres', name: 'Metres' },
  { id: 'Litres', name: 'Litres' },
  { id: 'Cubic Metres', name: 'Cubic Metres' },
  { id: 'Kilograms', name: 'Kilograms' },
];

export default function EditMaterialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Aggregates' as MaterialCategory,
    measurementType: 'Tonnes' as MeasurementUnit,
    defaultUnit: 'Tonnes',
    description: '',
    status: 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) loadMaterial();
  }, [id]);

  async function loadMaterial() {
    try {
      const m = await materialRepository.getById(id!);
      if (!m) {
        Alert.alert('Error', 'Material not found');
        router.back();
        return;
      }
      setMaterial(m);
      setForm({
        name: m.name || '',
        category: m.category || 'Aggregates',
        measurementType: m.measurementType || 'Tonnes',
        defaultUnit: m.defaultUnit || 'Tonnes',
        description: m.description || '',
        status: m.status || 'active',
      });
    } catch {
      Alert.alert('Error', 'Failed to load material');
      router.back();
    } finally {
      setLoading(false);
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
    if (!form.name.trim()) newErrors.name = 'Material name is required';
    if (!form.category) newErrors.category = 'Category is required';
    if (!form.measurementType) newErrors.measurementType = 'Measurement type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await materialRepository.update(id!, {
        name: form.name,
        category: form.category,
        measurementType: form.measurementType,
        defaultUnit: form.defaultUnit,
        description: form.description,
        status: form.status as any,
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('Saved', 'Material updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update material');
    } finally {
      setSaving(false);
    }
  }

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
          <Text style={[styles.title, { color: colors.text }]}>Edit Material</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Update {material?.name || 'material'} details
          </Text>
        </View>

        <Card>
          <Input
            label="Material Name"
            value={form.name}
            onChangeText={(v) => updateField('name', v)}
            placeholder="e.g. Ballast, Cement, Rebars"
            icon="cube-outline"
            required
            error={errors.name}
          />

          <Select
            label="Category"
            value={form.category}
            options={CATEGORIES}
            onSelect={(v) => updateField('category', v)}
            icon="folder-outline"
            required
            error={errors.category}
          />

          <Select
            label="Measurement Type"
            value={form.measurementType}
            options={UNITS}
            onSelect={(v) => updateField('measurementType', v)}
            icon="speedometer-outline"
            required
            error={errors.measurementType}
          />

          <Select
            label="Default Unit"
            value={form.defaultUnit}
            options={UNITS}
            onSelect={(v) => updateField('defaultUnit', v)}
            icon="scale-outline"
          />

          <Input
            label="Description"
            value={form.description}
            onChangeText={(v) => updateField('description', v)}
            placeholder="Brief description of the material"
            icon="document-text-outline"
            multiline
            numberOfLines={3}
          />

          <Select
            label="Status"
            value={form.status}
            options={[
              { id: 'active', name: 'Active' },
              { id: 'inactive', name: 'Inactive' },
            ]}
            onSelect={(v) => updateField('status', v)}
            icon="checkmark-circle-outline"
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
