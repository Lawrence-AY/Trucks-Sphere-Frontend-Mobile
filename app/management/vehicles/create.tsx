import { ResponsiveGrid } from '../../../components/ResponsiveGrid';
import { vendorOptions as buildVendorOptions } from '../../../utils/vendorOptions';
/**
 * Create Vehicle Screen - Belongs to a Vendor
 *
 * Features:
 *   - Select vendor (required)
 *   - Full vehicle details form
 *   - Compliance dates (insurance, inspection)
 */

import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { router } from '../../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { vehicleRepository } from '../../../services/repositories/VehicleRepository';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { useRealtimeCollection } from '../../../store/realtimeData';
import { useRealTimeSyncStore } from '../../../store/realTimeSyncStore';

const VEHICLE_TYPES = [
  { id: 'tipper', name: 'Tipper Truck' },
  { id: 'flatbed', name: 'Flatbed Truck' },
  { id: 'tanker', name: 'Tanker' },
  { id: 'trailer', name: 'Trailer' },
  { id: 'mixer', name: 'Concrete Mixer' },
  { id: 'other', name: 'Other' },
];

export default function CreateVehicleScreen() {
  const params = useLocalSearchParams<{ vendorId?: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const { data: vendors, loading: vendorsLoading, error: vendorsError } = useRealtimeCollection('vendors');
  const refresh = useRealTimeSyncStore((state) => state.refresh);
  const refreshVendors = useCallback(() => { void refresh('vendors'); }, [refresh]);
  useFocusEffect(refreshVendors);
  const [form, setForm] = useState({
    vendorId: params.vendorId || '',
    registrationNumber: '',
    make: '',
    model: '',
    year: '',
    type: '',
    color: '',
    insuranceExpiry: '',
    inspectionExpiry: '',
    lastInspection: '',
    status: 'active' as string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Pre-populate vendor ID from navigation params (e.g. from vendor detail page)
    if (params.vendorId) {
      updateField('vendorId', params.vendorId);
    }
  }, []);

  useEffect(() => vendorRepository.onChange(refreshVendors), [refreshVendors]);

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
    if (!form.registrationNumber.trim()) newErrors.registrationNumber = 'Registration number is required';
    if (!form.type) newErrors.type = 'Vehicle type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function resetForm() {
    setForm({
      vendorId: '',
      registrationNumber: '',
      make: '',
      model: '',
      year: '',
      type: '',
      color: '',
      insuranceExpiry: '',
      inspectionExpiry: '',
      lastInspection: '',
      status: 'active',
    });
    setErrors({});
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      await vehicleRepository.create({
        vendorId: form.vendorId,
        registrationNumber: form.registrationNumber.trim(),
        plateNumber: form.registrationNumber.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year.trim() ? Number(form.year.trim()) : undefined,
        type: form.type,
        color: form.color.trim() || undefined,
        insuranceExpiry: form.insuranceExpiry.trim() || undefined,
        inspectionExpiry: form.inspectionExpiry.trim() || undefined,
        lastInspection: form.lastInspection.trim() || undefined,
        status: form.status as any,
      });

      Alert.alert('Success', 'Vehicle created successfully');
      resetForm();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create vehicle';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  const vendorOptions = buildVendorOptions(vendors);

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
        <Text style={[styles.backTitle, { color: colors.text }]}>Create Vehicle</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        

        <Card>
          <ResponsiveGrid minItemWidth={280} maxColumns={2}>
<Select
            label="Vendor"
            value={form.vendorId}
            options={vendorOptions}
            onOpen={refreshVendors}
            onSelect={(v) => updateField('vendorId', v)}
            icon="business-outline"
            error={errors.vendorId || (vendorsError ? 'Unable to load vendors. Open the selector to retry.' : undefined)}
            placeholder={vendorsLoading && !vendors.length ? 'Loading vendors...' : 'Select vendor...'}
          />

          <Input
            label="Registration Number"
            value={form.registrationNumber}
            onChangeText={(v) => updateField('registrationNumber', v)}
            placeholder="e.g. KCA 123T"
            icon="car-outline"
            required
            error={errors.registrationNumber}
          />

          <Input
            label="Make"
            value={form.make}
            onChangeText={(v) => updateField('make', v)}
            placeholder="e.g. Scania"
            icon="build-outline"
            error={errors.make}
          />

          <Input
            label="Model"
            value={form.model}
            onChangeText={(v) => updateField('model', v)}
            placeholder="e.g. G460"
            icon="options-outline"
            error={errors.model}
          />

          <Input
            label="Year"
            value={form.year}
            onChangeText={(v) => updateField('year', v)}
            placeholder="e.g. 2022"
            icon="calendar-outline"
            keyboardType="numeric"
            error={errors.year}
          />

          <Select
            label="Vehicle Type"
            value={form.type}
            options={VEHICLE_TYPES}
            onSelect={(v) => updateField('type', v)}
            icon="layers-outline"
            required
            error={errors.type}
            placeholder="Select type..."
          />

          <Input
            label="Color"
            value={form.color}
            onChangeText={(v) => updateField('color', v)}
            placeholder="e.g. White, Blue, Red"
            icon="color-palette-outline"
          />

          <Input
            label="Insurance Expiry"
            value={form.insuranceExpiry}
            onChangeText={(v) => updateField('insuranceExpiry', v)}
            placeholder="e.g. 2025-12-31"
            icon="shield-outline"
          />

          <Input
            label="Inspection Expiry"
            value={form.inspectionExpiry}
            onChangeText={(v) => updateField('inspectionExpiry', v)}
            placeholder="e.g. 2025-06-30"
            icon="checkmark-circle-outline"
          />

          <Input
            label="Last Inspection"
            value={form.lastInspection}
            onChangeText={(v) => updateField('lastInspection', v)}
            placeholder="e.g. 2024-06-30"
            icon="time-outline"
          />
</ResponsiveGrid>

        </Card>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="secondary"
            style={styles.actionBtn}
          />
          <Button
            title="Create Vehicle"
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
  actions: {
    flexDirection: 'row',
    gap: Spacing.md, marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
