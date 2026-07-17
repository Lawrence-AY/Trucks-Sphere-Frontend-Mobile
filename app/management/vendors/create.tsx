/**
 * Create Vendor Screen - Full form with all vendor fields
 *
 * Features:
 *   - All required fields with validation
 *   - Auto-generate vendor ID
 *   - Create with optimistic UI
 *   - Navigate to vendor detail on success
 *   - Insurance & Compliance sections (single source of truth for drivers)
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
import api from '../../../services/api';

const STATUS_OPTIONS = [
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'suspended', name: 'Suspended' },
];

const ACCOUNT_STATUS_OPTIONS = [
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
];

export default function CreateVendorScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    // Company
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    kraPin: '',
    registrationNumber: '',
    businessPermit: '',
    companyActCR12: '',
    fleetSize: '',
    taxCompliance: '',
    // Insurance
    insuranceCompany: '',
    insuranceNumber: '',
    insuranceStartDate: '',
    insuranceExpiryDate: '',
    insuranceCommencingDate: '',
    insuranceSupplier: '',
    // NTSE
    ntsaInspectionExpiry: '',
    // WIBA
    wibaProvider: '',
    wibaStartDate: '',
    wibaEndDate: '',
    status: 'active' as string,
    password: '',
    confirmPassword: '',
    accountStatus: 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedUsername, setGeneratedUsername] = useState('');

  useEffect(() => {
    const contactPerson = form.contactPerson.trim();
    if (!contactPerson) {
      setGeneratedUsername('');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await api.get<{ username: string }>(
          `/api/vendors/username?contactPerson=${encodeURIComponent(contactPerson)}`,
        );
        if (!cancelled) setGeneratedUsername(response.data.username || '');
      } catch {
        if (!cancelled) setGeneratedUsername('Will be generated when saved');
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.contactPerson]);

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
    if (!form.email.trim()) newErrors.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email address';
    if (!form.password || form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      const result = await api.post<{ username: string }>('/api/vendors/with-account', {
        vendor: {
          companyName: form.companyName.trim(),
          contactPerson: form.contactPerson.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim() || undefined,
          kraPin: form.kraPin.trim() || undefined,
          registrationNumber: form.registrationNumber.trim() || undefined,
          businessPermit: form.businessPermit.trim() || undefined,
          companyActCR12: form.companyActCR12.trim() || undefined,
          fleetSize: form.fleetSize.trim() ? Number(form.fleetSize) : undefined,
          taxCompliance: form.taxCompliance.trim() || undefined,
          insuranceCompany: form.insuranceCompany.trim() || undefined,
          insuranceNumber: form.insuranceNumber.trim() || undefined,
          insuranceStartDate: form.insuranceStartDate.trim() || undefined,
          insuranceExpiryDate: form.insuranceExpiryDate.trim() || undefined,
          insuranceCommencingDate: form.insuranceCommencingDate.trim() || undefined,
          insuranceSupplier: form.insuranceSupplier.trim() || undefined,
          ntsaInspectionExpiry: form.ntsaInspectionExpiry.trim() || undefined,
          wibaProvider: form.wibaProvider.trim() || undefined,
          wibaStartDate: form.wibaStartDate.trim() || undefined,
          wibaEndDate: form.wibaEndDate.trim() || undefined,
          status: form.status,
        },
        account: {
          email: form.email.trim(),
          password: form.password,
          isActive: form.accountStatus === 'active',
        },
      });

      setForm({
        companyName: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        kraPin: '',
        registrationNumber: '',
        businessPermit: '',
        companyActCR12: '',
        fleetSize: '',
        taxCompliance: '',
        insuranceCompany: '',
        insuranceNumber: '',
        insuranceStartDate: '',
        insuranceExpiryDate: '',
        insuranceCommencingDate: '',
        insuranceSupplier: '',
        ntsaInspectionExpiry: '',
        wibaProvider: '',
        wibaStartDate: '',
        wibaEndDate: '',
        status: 'active',
        password: '',
        confirmPassword: '',
        accountStatus: 'active',
      });
      setGeneratedUsername('');
      Alert.alert('Success', `Vendor created. Login username: ${result.data.username}`, [
        { text: 'View Vendors', onPress: () => router.back() },
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
            Add a new transport vendor to the system. Insurance & compliance set here become the source of truth for all drivers under this vendor.
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
          <Input
            label="Business Permit"
            value={form.businessPermit}
            onChangeText={(v) => updateField('businessPermit', v)}
            placeholder="e.g. BP-2024-001"
            icon="document-attach-outline"
          />
          <Input
            label="Company Act CR12"
            value={form.companyActCR12}
            onChangeText={(v) => updateField('companyActCR12', v)}
            placeholder="e.g. CR12-2024-001"
            icon="document-text-outline"
          />
          <Input
            label="Fleet Size"
            value={form.fleetSize}
            onChangeText={(v) => updateField('fleetSize', v)}
            placeholder="e.g. 15"
            icon="car-outline"
            keyboardType="numeric"
          />
          <Input
            label="Tax Compliance"
            value={form.taxCompliance}
            onChangeText={(v) => updateField('taxCompliance', v)}
            placeholder="e.g. Compliant / Non-Compliant"
            icon="checkmark-done-outline"
          />
        </Card>

        {/* Insurance Details */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Insurance Details</Text>
        <Card>
          <Input
            label="Insurance Company"
            value={form.insuranceCompany}
            onChangeText={(v) => updateField('insuranceCompany', v)}
            placeholder="e.g. Jubilee Insurance"
            icon="shield-outline"
          />
          <Input
            label="Insurance Number"
            value={form.insuranceNumber}
            onChangeText={(v) => updateField('insuranceNumber', v)}
            placeholder="e.g. INS-2024-001"
            icon="receipt-outline"
          />
          <Input
            label="Insurance Start Date"
            value={form.insuranceStartDate}
            onChangeText={(v) => updateField('insuranceStartDate', v)}
            placeholder="e.g. 2024-01-01"
            icon="calendar-outline"
          />
          <Input
            label="Insurance Expiry Date"
            value={form.insuranceExpiryDate}
            onChangeText={(v) => updateField('insuranceExpiryDate', v)}
            placeholder="e.g. 2025-01-01"
            icon="calendar-outline"
          />
          <Input
            label="Insurance Commencing Date"
            value={form.insuranceCommencingDate}
            onChangeText={(v) => updateField('insuranceCommencingDate', v)}
            placeholder="e.g. 2024-01-01"
            icon="calendar-outline"
          />
          <Input
            label="Insurance Supplier"
            value={form.insuranceSupplier}
            onChangeText={(v) => updateField('insuranceSupplier', v)}
            placeholder="e.g. ABC Brokers Ltd"
            icon="people-outline"
          />
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
        <Card>
          <Input
            label="Email Address"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            placeholder="e.g. info@swiftlogistics.com"
            icon="mail-outline"
            keyboardType="email-address"
            required
            error={errors.email}
          />
          <Input
            label="Generated Username"
            value={generatedUsername}
            placeholder="Enter a contact person to generate"
            icon="person-outline"
            onChangeText={() => undefined}
            editable={false}
          />
          <Input
            label="Password"
            value={form.password}
            onChangeText={(v) => updateField('password', v)}
            placeholder="At least 6 characters"
            icon="lock-closed-outline"
            secureTextEntry
            required
            error={errors.password}
          />
          <Input
            label="Confirm Password"
            value={form.confirmPassword}
            onChangeText={(v) => updateField('confirmPassword', v)}
            placeholder="Re-enter password"
            icon="lock-closed-outline"
            secureTextEntry
            required
            error={errors.confirmPassword}
          />
          <Select
            label="Account Status"
            value={form.accountStatus}
            options={ACCOUNT_STATUS_OPTIONS}
            onSelect={(v) => updateField('accountStatus', v)}
            icon="checkmark-circle-outline"
          />
          <Input label="Role" value="Vendor" icon="shield-outline" onChangeText={() => undefined} editable={false} />
        </Card>

        {/* Compliance Details */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Compliance</Text>
        <Card>
          <Input
            label="NTSE Inspection Expiry"
            value={form.ntsaInspectionExpiry}
            onChangeText={(v) => updateField('ntsaInspectionExpiry', v)}
            placeholder="e.g. 2025-06-30"
            icon="checkmark-circle-outline"
          />
          <Input
            label="WIBA Provider"
            value={form.wibaProvider}
            onChangeText={(v) => updateField('wibaProvider', v)}
            placeholder="e.g. WIBA Insurance Ltd"
            icon="shield-checkmark-outline"
          />
          <Input
            label="WIBA Start Date"
            value={form.wibaStartDate}
            onChangeText={(v) => updateField('wibaStartDate', v)}
            placeholder="e.g. 2024-01-01"
            icon="calendar-outline"
          />
          <Input
            label="WIBA End Date"
            value={form.wibaEndDate}
            onChangeText={(v) => updateField('wibaEndDate', v)}
            placeholder="e.g. 2025-01-01"
            icon="calendar-outline"
          />
        </Card>

        <Card>
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
  container: { flex: 1 },
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
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  header: { marginBottom: Spacing.lg },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  actionBtn: { flex: 1 },
});
