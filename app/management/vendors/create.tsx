import { ResponsiveGrid } from '../../../components/ResponsiveGrid';
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

import React, { useEffect, useRef, useState } from 'react';
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
import { router } from '../../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import api from '../../../services/api';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { Vendor } from '@/store/types';
import { generateStrongPassword, getStrongPasswordError, PASSWORD_REQUIREMENTS } from '../../../utils/passwordPolicy';

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
  const createInFlight = useRef(false);
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
  const [kraChecking, setKraChecking] = useState(false);
  const [kraVerifiedName, setKraVerifiedName] = useState('');
  const [kraEnabled, setKraEnabled] = useState(false);

  useEffect(() => {
    api.get<{ kraEnabled?: boolean }>('/api/feature-flags')
      .then(({ data }) => setKraEnabled(data.kraEnabled === true))
      .catch(() => setKraEnabled(false));
  }, []);

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

  async function validateKraPin() {
    const kraPin = form.kraPin.trim();
    if (!kraPin) return;
    setKraChecking(true);
    try {
      const response = await api.post<{ companyName?: string }>('/api/vendors/validate-kra-pin', { kraPin });
      const companyName = String(response.data.companyName || '').trim();
      setKraVerifiedName(companyName);
      if (companyName && !form.companyName.trim()) updateField('companyName', companyName);
      setErrors((current) => { const next = { ...current }; delete next.kraPin; return next; });
    } catch (error: any) {
      setKraVerifiedName('');
      setErrors((current) => ({ ...current, kraPin: error?.response?.data?.error || error?.message || 'KRA PIN could not be validated' }));
    } finally { setKraChecking(false); }
  }

  function suggestStrongPassword() {
    const password = generateStrongPassword();
    setForm((prev) => ({ ...prev, password, confirmPassword: password }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.password;
      delete next.confirmPassword;
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!form.contactPerson.trim()) newErrors.contactPerson = 'Contact person is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    const createAccount = Boolean(form.email.trim() || form.password || form.confirmPassword);
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) newErrors.email = 'Invalid email address';
    if (createAccount && !form.password) newErrors.password = 'Password is required when creating a login account';
    else if (createAccount) {
      const passwordError = getStrongPasswordError(form.password);
      if (passwordError) newErrors.password = passwordError;
    }
    if (createAccount && form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (createInFlight.current || !validate()) return;
    createInFlight.current = true;

    setSaving(true);
    try {
      const vendor: Partial<Vendor> = {
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
          status: form.status as Vendor['status'],
        };
      const createAccount = Boolean(form.email.trim() || form.password || form.confirmPassword);
      const result = createAccount
        ? await vendorRepository.createWithAccount({
            vendor,
            account: {
              email: form.email.trim(),
              password: form.password,
              isActive: form.accountStatus === 'active',
            },
          })
        : { vendor: await vendorRepository.create(vendor) };

      if (!result || typeof result !== 'object' || !result.vendor?.id) {
        throw new Error('The server did not confirm the saved vendor. Check the Vendors list before retrying.');
      }
      const savedUsername = (result as { username?: string }).username;
      if (createAccount && !savedUsername) throw new Error('The server did not confirm the login username. Check the vendor account before retrying.');
      const confirmation = savedUsername
        ? `Vendor created. Login username: ${savedUsername}`
        : 'Vendor created without a login account.';

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
      setKraVerifiedName('');
      Alert.alert('Success', confirmation, [
        { text: 'View Vendors', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const code = err?.code || err?.response?.data?.code;
      const msg = code === 'VENDOR_ALREADY_EXISTS'
        ? 'A vendor already uses this company name, KRA PIN, or phone number. Check the Vendors list or correct those details.'
        : err?.message || 'Failed to create vendor';
      Alert.alert('Error', msg);
    } finally {
      createInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.backBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={[styles.backTitle, { color: colors.text }]}>Create Vendor</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        

        <Card>
          <ResponsiveGrid minItemWidth={280} maxColumns={2}>
          <Input
            label={kraChecking ? 'KRA PIN (checking...)' : 'KRA PIN'}
            value={form.kraPin}
            onChangeText={(v) => { setKraVerifiedName(''); updateField('kraPin', v.toUpperCase()); }}
            onBlur={validateKraPin}
            placeholder="e.g. P051234567Z"
            icon="document-text-outline"
            error={errors.kraPin}
          />
          <TouchableOpacity
            onPress={validateKraPin}
            disabled={kraChecking || !form.kraPin.trim()}
            style={[styles.kraVerifyButton, { backgroundColor: kraChecking || !form.kraPin.trim() ? colors.border : colors.primary }]}
          >
            <Ionicons name={kraChecking ? 'sync-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
            <Text style={styles.kraVerifyText}>{kraChecking ? 'Checking KRA PIN…' : 'Verify KRA PIN'}</Text>
          </TouchableOpacity>
          {kraVerifiedName ? <Text style={{ color: '#059669', marginBottom: Spacing.sm }}>KRA taxpayer: {kraVerifiedName}</Text> : null}
          <Input
            label="Company Name"
            value={form.companyName}
            editable={!(kraEnabled && kraVerifiedName)}
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
            placeholder="Enter contact name"
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
</ResponsiveGrid>
        </Card>

        {/* Insurance Details */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Insurance Details</Text>
        <Card>
          <ResponsiveGrid minItemWidth={280} maxColumns={2}>
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
</ResponsiveGrid>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
        <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Enter a password to create a username login. Email is optional.</Text>
        <Card>
          <ResponsiveGrid minItemWidth={280} maxColumns={2}>
<Input
            label="Email Address (optional)"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            placeholder="e.g. info@swiftlogistics.com"
            icon="mail-outline"
            keyboardType="email-address"
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
            placeholder="Enter a strong password"
            icon="lock-closed-outline"
            secureTextEntry
            error={errors.password}
          />
</ResponsiveGrid>
          <Button
            title="Suggest strong password"
            onPress={suggestStrongPassword}
            variant="secondary"
            size="sm"
            icon="refresh-outline"
            style={styles.passwordSuggestion}
          />
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{PASSWORD_REQUIREMENTS}</Text>
          <Input
            label="Confirm Password"
            value={form.confirmPassword}
            onChangeText={(v) => updateField('confirmPassword', v)}
            placeholder="Re-enter password"
            icon="lock-closed-outline"
            secureTextEntry
            error={errors.confirmPassword}
          />
         </Card>

        {/* Compliance Details */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Compliance</Text>
        <Card>
          <ResponsiveGrid minItemWidth={280} maxColumns={2}>
<Input
            label="NTSA Inspection Expiry"
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
  kraVerifyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, paddingVertical: 11, marginBottom: Spacing.sm },
  kraVerifyText: { color: '#FFFFFF', fontWeight: '800' },
  header: { marginBottom: Spacing.xs},
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: Spacing.xs},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700', marginTop: Spacing.xs, marginBottom: Spacing.xs,
  },
  passwordSuggestion: {
    alignSelf: 'flex-start', marginTop: Spacing.xs,
  },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  actionBtn: { flex: 1 },
});
