/**
 * Create Driver Screen - Belongs to a Vendor
 *
 * Features:
 *   - Select vendor (required)
 *   - Full driver details form
 *   - License information
 *   - Emergency contact
 *   - Photo upload placeholder
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
  Image,
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
import { driverRepository } from '../../../services/repositories/DriverRepository';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { Vendor } from '../../../store/types';

const STATUS_OPTIONS = [
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'suspended', name: 'Suspended' },
];

export default function CreateDriverScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState({
    vendorId: '',
    fullName: '',
    phone: '',
    email: '',
    nationalId: '',
    licenseNumber: '',
    licenseClass: '',
    licenseExpiry: '',
    emergencyContact: '',
    status: 'active' as string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    try {
      const v = await vendorRepository.getAll();
      setVendors(v);
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
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!form.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      await driverRepository.create({
        vendorId: form.vendorId,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        nationalId: form.nationalId.trim() || undefined,
        licenseNumber: form.licenseNumber.trim(),
        licenseClass: form.licenseClass.trim() || undefined,
        licenseExpiry: form.licenseExpiry.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        status: form.status as any,
      });

      Alert.alert('Success', 'Driver created successfully', [
        {
          text: 'View Drivers',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create driver';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  const vendorOptions = vendors.map((v) => ({ id: v.id, name: v.companyName }));

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
        <Text style={styles.backTitle}>Onboard Driver</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Onboard Driver</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Add a new driver to the system
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

          <Input
            label="Full Name"
            value={form.fullName}
            onChangeText={(v) => updateField('fullName', v)}
            placeholder="e.g. John Doe"
            icon="person-outline"
            required
            error={errors.fullName}
          />

          <Input
            label="Phone Number"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            placeholder="e.g. 0712345678"
            icon="call-outline"
            keyboardType="phone-pad"
            required
            error={errors.phone}
          />

          <Input
            label="National ID"
            value={form.nationalId}
            onChangeText={(v) => updateField('nationalId', v)}
            placeholder="e.g. 12345678"
            icon="finger-print-outline"
            keyboardType="numeric"
          />

          <Input
            label="Email Address"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            placeholder="e.g. john@example.com"
            icon="mail-outline"
            keyboardType="email-address"
          />

          <Input
            label="License Number"
            value={form.licenseNumber}
            onChangeText={(v) => updateField('licenseNumber', v)}
            placeholder="e.g. DL123456"
            icon="card-outline"
            required
            error={errors.licenseNumber}
          />

          <Input
            label="License Class"
            value={form.licenseClass}
            onChangeText={(v) => updateField('licenseClass', v)}
            placeholder="e.g. B, C, E"
            icon="options-outline"
          />

          <Input
            label="License Expiry"
            value={form.licenseExpiry}
            onChangeText={(v) => updateField('licenseExpiry', v)}
            placeholder="e.g. 2025-12-31"
            icon="calendar-outline"
          />

          <Input
            label="Emergency Contact"
            value={form.emergencyContact}
            onChangeText={(v) => updateField('emergencyContact', v)}
            placeholder="e.g. 0712345679"
            icon="alert-circle-outline"
          />

          <Select
            label="Status"
            value={form.status}
            options={STATUS_OPTIONS}
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
            title="Create Driver"
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
