/**
 * Create Driver Screen - Belongs to a Vendor
 *
 * Features:
 *   - Select vendor (required)
 *   - Full driver details form
 *   - License information
 *   - Insurance information
 *   - NTSE & WIBA compliance
 *   - Photo upload
 *   - Emergency contact
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { Spacing, Radius } from '../../../constants/theme';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { driverRepository } from '../../../services/repositories/DriverRepository';
import { vendorRepository } from '../../../services/repositories/VendorRepository';
import { uploadDriverPhoto } from '../../../services/uploadService';
import { Vendor } from '../../../store/types';

const STATUS_OPTIONS = [
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'suspended', name: 'Suspended' },
];

export default function CreateDriverScreen() {
  const params = useLocalSearchParams<{ vendorId?: string }>();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState({
    vendorId: params.vendorId || '',
    fullName: '',
    phone: '',
    email: '',
    nationalId: '',
    licenseNumber: '',
    licenseClass: '',
    licenseExpiry: '',
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
    // Emergency
    emergencyContact: '',
    status: 'active' as string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadVendors();
    // Pre-populate vendor ID from navigation params (e.g. from vendor detail page)
    if (params.vendorId) {
      updateField('vendorId', params.vendorId);
    }
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

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera roll permission is required to upload a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera permission is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.vendorId) newErrors.vendorId = 'Vendor is required';
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!form.nationalId.trim()) newErrors.nationalId = 'National ID is required';
    if (!form.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function resetForm() {
    setForm({
      vendorId: '',
      fullName: '',
      phone: '',
      email: '',
      nationalId: '',
      licenseNumber: '',
      licenseClass: '',
      licenseExpiry: '',
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
      emergencyContact: '',
      status: 'active',
    });
    setPhotoUri(null);
    setErrors({});
  }

  async function handleCreate() {
    if (!validate()) return;

    setSaving(true);
    try {
      let photoURL: string | undefined;
      if (photoUri) {
        setUploadingPhoto(true);
        try {
          const uploaded = await uploadDriverPhoto('new-driver', photoUri);
          photoURL = uploaded?.photoURL;
        } catch (err) {
          console.warn('Photo upload failed, continuing without photo');
        }
        setUploadingPhoto(false);
      }

      await driverRepository.create({
        vendorId: form.vendorId,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        nationalId: form.nationalId.trim() || undefined,
        licenseNumber: form.licenseNumber.trim(),
        licenseClass: form.licenseClass.trim() || undefined,
        licenseExpiry: form.licenseExpiry.trim() || undefined,
        photoURL: photoURL || undefined,
        // Insurance
        insuranceCompany: form.insuranceCompany.trim() || undefined,
        insuranceNumber: form.insuranceNumber.trim() || undefined,
        insuranceStartDate: form.insuranceStartDate.trim() || undefined,
        insuranceExpiryDate: form.insuranceExpiryDate.trim() || undefined,
        insuranceCommencingDate: form.insuranceCommencingDate.trim() || undefined,
        insuranceSupplier: form.insuranceSupplier.trim() || undefined,
        // NTSE
        ntsaInspectionExpiry: form.ntsaInspectionExpiry.trim() || undefined,
        // WIBA
        wibaProvider: form.wibaProvider.trim() || undefined,
        wibaStartDate: form.wibaStartDate.trim() || undefined,
        wibaEndDate: form.wibaEndDate.trim() || undefined,
        // Emergency
        emergencyContact: form.emergencyContact.trim() || undefined,
        status: form.status as any,
      });

      Alert.alert('Success', 'Driver created successfully');
      resetForm();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create driver';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  }

  const vendorOptions = vendors.map((v) => ({ id: v.id, name: v.companyName || (v as any).name || 'Unknown Vendor' }));

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

          {/* Photo Upload */}
          <View style={styles.photoSectionCard}>
            <View style={styles.photoSectionHeader}>
              <View style={[styles.photoSectionIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="camera-outline" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.photoSectionTitle, { color: colors.text }]}>Driver Photo</Text>
              {photoUri ? (
                <View style={[styles.photoStatusBadge, { backgroundColor: '#10B98115' }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={[styles.photoStatusText, { color: '#10B981' }]}>Ready</Text>
                </View>
              ) : (
                <View style={[styles.photoStatusBadge, { backgroundColor: colors.textMuted + '20' }]}>
                  <Text style={[styles.photoStatusText, { color: colors.textMuted }]}>Optional</Text>
                </View>
              )}
            </View>
            <Text style={[styles.photoSectionSub, { color: colors.textMuted }]}>
              Capture or select a photo of the driver for identification.
            </Text>
            {photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoPreviewLarge}
                  resizeMode="cover"
                />
                {uploadingPhoto && (
                  <View style={styles.photoPreviewOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.photoPreviewOverlayText}>Uploading...</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.photoPreviewWrap, styles.photoPreviewPlaceholder]}>
                <Ionicons name="person-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>No photo selected</Text>
              </View>
            )}
            <View style={styles.photoActionsRow}>
              <TouchableOpacity
                style={[styles.photoBtnFull, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={handleTakePhoto}
                disabled={uploadingPhoto}
              >
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={photoUri ? '#10B981' : colors.primary}
                />
                <Text style={[styles.photoBtnText, { color: photoUri ? '#10B981' : colors.primary }]}>
                  {photoUri ? 'Retake Photo' : 'Take Photo'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoBtnFull, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
              >
                <Ionicons name="images-outline" size={20} color={colors.primary} />
                <Text style={[styles.photoBtnText, { color: colors.primary }]}>Gallery</Text>
              </TouchableOpacity>
            </View>
            {photoUri && (
              <TouchableOpacity
                style={[styles.photoRemoveBtn, { borderColor: '#FECACA' }]}
                onPress={() => setPhotoUri(null)}
                disabled={uploadingPhoto}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={[styles.photoRemoveText, { color: '#EF4444' }]}>Remove Photo</Text>
              </TouchableOpacity>
            )}
          </View>

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
            label="Email Address"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            placeholder="e.g. john@example.com"
            icon="mail-outline"
            keyboardType="email-address"
          />

          <Input
            label="National ID"
            value={form.nationalId}
            onChangeText={(v) => updateField('nationalId', v)}
            placeholder="e.g. 12345678"
            icon="finger-print-outline"
            keyboardType="numeric"
            required
            error={errors.nationalId}
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

        {/* Emergency Contact */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Emergency Contact</Text>
        <Card>
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
            loading={saving || uploadingPhoto}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  photoSection: {
    marginBottom: Spacing.md,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  photoBox: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.lg,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoHint: {
    fontSize: 9,
    fontWeight: '600',
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  cameraText: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeBtn: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
  },
  // New photo section styles (matching quarry weigh-out style)
  photoSectionCard: {
    marginBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  photoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  photoSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  photoStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  photoStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  photoSectionSub: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  photoPreviewWrap: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    backgroundColor: '#F1F5F9',
  },
  photoPreviewLarge: {
    width: '100%',
    height: '100%',
  },
  photoPreviewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  photoPreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreviewOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  photoBtnFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  photoRemoveText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
