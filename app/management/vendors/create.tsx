/**
 * Create Vendor Screen - Full form with all vendor fields
 *
 * Features:
 *   - All required fields with validation
 *   - Auto-generate vendor ID
 *   - Create with optimistic UI
 *   - Navigate to vendor detail on success
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
import { Spacing } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { vendorRepository } from '../../../services/repositories/VendorRepository';

const STATUS_OPTIONS = [
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'suspended', name: 'Suspended' },
];

export default function CreateVendorScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    kraPin: '',
    registrationNumber: '',
    status: 'active' as string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email address';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      await vendorRepository.create({
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        kraPin: form.kraPin.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        status: form.status as any,
      });

      Alert.alert('Success', 'Vendor created successfully', [
        {
          text: 'View Vendors',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create vendor';
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
        <Text style={styles.backTitle}>Create Vendor</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create Vendor</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Add a new transport vendor to the system
          </Text>
        </View>

        <Card>
          <Input
            label="Company Name"
            value={form.companyName}
            onChangeText={(v) => updateField('companyName', v)}
            placeholder="e.g. Swift Logistics Ltd"
            icon="business-outline"
            required
            error={errors.companyName}
          />

          <Input
            label="Contact Person"
            value={form.contactPerson}
            onChangeText={(v) => updateField('contactPerson', v)}
            placeholder="e.g. John Doe"
            icon="person-outline"
            required
            error={errors.contactPerson}
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
            label="Email Address"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            placeholder="e.g. info@swiftlogistics.com"
            icon="mail-outline"
            keyboardType="email-address"
            error={errors.email}
          />

          <Input
            label="Physical Address"
            value={form.address}
            onChangeText={(v) => updateField('address', v)}
            placeholder="e.g. Industrial Area, Nairobi"
            icon="location-outline"
          />

          <Input
            label="KRA PIN"
            value={form.kraPin}
            onChangeText={(v) => updateField('kraPin', v)}
            placeholder="e.g. P051234567Z"
            icon="document-text-outline"
          />

          <Input
            label="Registration Number"
            value={form.registrationNumber}
            onChangeText={(v) => updateField('registrationNumber', v)}
            placeholder="e.g. BRS/2024/12345"
            icon="receipt-outline"
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
            title="Create Vendor"
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
