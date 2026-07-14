/**
 * Edit Vendor Screen - Update vendor details
 *
 * Features:
 *   - Pre-populated form with existing data
 *   - Update all vendor fields
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
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing, Radius } from '../../../../constants/theme';
import { Card } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Button } from '../../../../components/ui/Button';
import { LoadingSkeleton } from '../../../../components/ui/LoadingSkeleton';
import { vendorRepository } from '../../../../services/repositories/VendorRepository';
import { Vendor } from '../../../../store/types';

const STATUS_OPTIONS = [
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'suspended', name: 'Suspended' },
];

export default function EditVendorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    kraPin: '',
    registrationNumber: '',
    status: 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) loadVendor();
  }, [id]);

  async function loadVendor() {
    try {
      const v = await vendorRepository.getById(id!);
      if (!v) {
        Alert.alert('Error', 'Vendor not found');
        router.back();
        return;
      }
      setVendor(v);
      setForm({
        companyName: v.companyName || '',
        contactPerson: v.contactPerson || '',
        phone: v.phone || '',
        email: v.email || '',
        address: v.address || '',
        kraPin: v.kraPin || '',
        registrationNumber: v.registrationNumber || '',
        status: v.status || 'active',
      });
    } catch {
      Alert.alert('Error', 'Failed to load vendor');
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
    if (!form.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!form.contactPerson.trim()) newErrors.contactPerson = 'Contact person is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await vendorRepository.update(id!, {
        companyName: form.companyName,
        contactPerson: form.contactPerson,
        phone: form.phone,
        email: form.email,
        address: form.address,
        kraPin: form.kraPin,
        registrationNumber: form.registrationNumber,
        status: form.status as any,
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('Saved', 'Vendor updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update vendor');
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
          <Text style={[styles.title, { color: colors.text }]}>Edit Vendor</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Update {vendor?.companyName || 'vendor'} details
          </Text>
        </View>

        <Card>
          <Input
            label="Company Name"
            value={form.companyName}
            onChangeText={(v) => updateField('companyName', v)}
            placeholder="e.g. Mombasa Cement Ltd"
            icon="business-outline"
            required
            error={errors.companyName}
          />
          <Input
            label="Registration Number"
            value={form.registrationNumber}
            onChangeText={(v) => updateField('registrationNumber', v)}
            placeholder="e.g. CPR/2024/12345"
            icon="receipt-outline"
          />
          <Input
            label="KRA PIN"
            value={form.kraPin}
            onChangeText={(v) => updateField('kraPin', v)}
            placeholder="e.g. P051234567Z"
            icon="document-text-outline"
          />
          <Input
            label="Contact Person"
            value={form.contactPerson}
            onChangeText={(v) => updateField('contactPerson', v)}
            placeholder="e.g. John Kamau"
            icon="person-outline"
            required
            error={errors.contactPerson}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChangeText={(v) => updateField('phone', v)}
            placeholder="e.g. 0712345678"
            icon="call-outline"
            keyboardType="phone-pad"
            required
            error={errors.phone}
          />
          <Input
            label="Email"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            placeholder="e.g. info@company.com"
            icon="mail-outline"
            keyboardType="email-address"
            error={errors.email}
          />
          <Input
            label="Physical Address"
            value={form.address}
            onChangeText={(v) => updateField('address', v)}
            placeholder="e.g. Mombasa Road, Nairobi"
            icon="location-outline"
            multiline
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
