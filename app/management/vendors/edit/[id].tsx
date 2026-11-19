import { ResponsiveGrid } from '../../../../components/ResponsiveGrid';
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
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { router } from '../../../../utils/router';
import { useTheme } from '../../../../hooks/useTheme';
import { Gap, Radius, Spacing } from '../../../../constants/theme';
import { Card } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { StackScreen } from '../../../../components/ui/StackScreen';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { LoadingSkeleton } from '../../../../components/ui/LoadingSkeleton';
import { vendorRepository } from '../../../../services/repositories/VendorRepository';
import { Vendor } from '@/store/types';
import { useAuthStore } from '@/store/authStore';
import { MANAGEMENT_ROLES, normalizeRole } from '../../../../utils/access';
import * as ImagePicker from 'expo-image-picker';
import { uploadVendorLogo } from '../../../../services/api';

export default function EditVendorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const user = useAuthStore((state) => state.user);
  const canDeleteVendor = normalizeRole(user?.role) === MANAGEMENT_ROLES.SUPER_ADMIN;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    kraPin: '',
    registrationNumber: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoAsset, setLogoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

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
        contactPerson: v.contactPerson || (v as any).contact || '',
        phone: v.phone || (v as any).phoneNumber || '',
        email: v.email || '',
        address: v.address || '',
        kraPin: v.kraPin || '',
        registrationNumber: v.registrationNumber || '',
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
        updatedAt: new Date().toISOString(),
      });
      if (logoAsset) await uploadVendorLogo(id!, { uri: logoAsset.uri, name: logoAsset.fileName, mimeType: logoAsset.mimeType });
      Alert.alert('Saved', 'Vendor updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update vendor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await vendorRepository.delete(id!);
      Alert.alert('Deleted', 'Vendor deleted successfully.', [
        { text: 'OK', onPress: () => router.replace('/management/vendors' as any) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete vendor');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
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
      <Stack.Screen options={{ title: 'Edit Vendor', headerShown: false }} />
      <StackScreen title="Edit Vendor" fallbackHref="/management/vendors" contentStyle={styles.content}>
      

        <Card>
          <ResponsiveGrid minItemWidth={280} maxColumns={2}>
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
</ResponsiveGrid>
        </Card>

        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', marginBottom: Spacing.sm }}>Vendor Logo (optional)</Text>
          {(logoAsset?.uri || (vendor as any)?.logoURL) ? (
            <Image
              source={{ uri: logoAsset?.uri || (vendor as any)?.logoURL }}
              accessibilityLabel="Vendor logo preview"
              resizeMode="contain"
              style={styles.logoPreview}
            />
          ) : null}
          <Button title={logoAsset ? 'Logo selected' : 'Choose PNG/WebP logo'} onPress={async () => { const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 }); if (!r.canceled) { const a = r.assets[0]; const ratio = (a.width || 0) / (a.height || 1); if (!['image/png','image/webp'].includes(a.mimeType || '') || (a.fileSize || 0) > 2 * 1024 * 1024 || (a.width || 0) < 200 || (a.height || 0) < 75 || !(ratio >= 1.4 || (ratio >= .85 && ratio <= 1.15))) { Alert.alert('Invalid logo', 'Use PNG/WebP, max 2 MB, minimum 200 × 75 px, horizontal or square.'); return; } setLogoAsset(a); } }} icon="image-outline" variant="secondary" />
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: Spacing.sm }}>Optional. Appears beside this vendor on Delivery Notes only. Recommended: 400 × 150 px or 250 × 250 px.</Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            onPress={() => { setForm({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    kraPin: '',
    registrationNumber: '',
  }); setErrors({}); (() => router.back())(); }}
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

        {canDeleteVendor ? (
          <Button
            title="Delete Vendor"
            onPress={() => setShowDeleteConfirm(true)}
            variant="danger"
            icon="trash-outline"
            loading={deleting}
            fullWidth
          />
        ) : null}
      </StackScreen>
      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Vendor"
        message={`Delete ${vendor?.companyName || 'this vendor'}? This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />
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
    gap: Gap, marginTop: Spacing.xs, marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  logoPreview: {
    width: '100%',
    height: 120,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
  },
});
