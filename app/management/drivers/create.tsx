/**
 * Create Driver Screen - Belongs to a Vendor
 *
 * Features:
 *   - Select vendor (required)
 *   - Full driver details form
 *   - License information
 *   - Photo upload (after driver creation)
 *   - Emergency contact
 *
 * NOTE: Insurance & Compliance fields have been moved to the Vendor form.
 * Drivers inherit these from their linked vendor.
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
import api from '../../../services/api';
import { uploadDriverPhoto } from '../../../services/uploadService';
import { collectionCache } from '../../../services/cache/CollectionCache';
import { Vendor } from '../../../store/types';

const STATUS_OPTIONS = [
  { id: 'active', name: 'Active' },
  { id: 'inactive', name: 'Inactive' },
  { id: 'suspended', name: 'Suspended' },
];

export default function CreateDriverScreen() {
  const params = useLocalSearchParams<{ vendorId?: string; id?: string }>();
  const driverId = typeof params.id === 'string' ? params.id : undefined;
  const isEditMode = Boolean(driverId);
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [loadingDriver, setLoadingDriver] = useState(isEditMode);
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
    emergencyContact: '',
    status: 'active' as string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadVendors();
    if (params.vendorId) {
      updateField('vendorId', params.vendorId);
    }
    if (driverId) loadDriver(driverId);
  }, [driverId, params.vendorId]);

  async function loadDriver(id: string) {
    try {
      const driver = await driverRepository.getById(id);
      if (!driver) {
        Alert.alert('Driver not found');
        router.back();
        return;
      }
      setForm({
        vendorId: driver.vendorId || '',
        fullName: driver.fullName || (driver as any).name || '',
        phone: driver.phone || '',
        email: driver.email || '',
        nationalId: driver.nationalId || '',
        licenseNumber: driver.licenseNumber || '',
        licenseClass: driver.licenseClass || '',
        licenseExpiry: driver.licenseExpiry || '',
        emergencyContact: driver.emergencyContact || '',
        status: driver.status || 'active',
      });
    } finally {
      setLoadingDriver(false);
    }
  }

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

  async function checkNationalId(): Promise<boolean> {
    const nationalId = form.nationalId.trim();
    if (!nationalId) return false;
    try {
      const response = await api.get<{ available: boolean }>(
        `/api/drivers/national-id/${encodeURIComponent(nationalId)}${driverId ? `?excludeId=${encodeURIComponent(driverId)}` : ''}`,
      );
      if (!response.data.available) {
        setErrors((prev) => ({ ...prev, nationalId: 'A driver with this National ID already exists.' }));
        return false;
      }
      return true;
    } catch {
      // The server repeats this validation when saving; do not block valid offline form entry.
      return true;
    }
  }

  async function validate(): Promise<boolean> {
    const newErrors: Record<string, string> = {};
    if (!form.vendorId) newErrors.vendorId = 'Vendor is required';
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!form.nationalId.trim()) newErrors.nationalId = 'National ID is required';
    if (!form.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }
    const nationalIdAvailable = await checkNationalId();
    if (!nationalIdAvailable) return false;
    setErrors({});
    return true;
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
      emergencyContact: '',
      status: 'active',
    });
    setPhotoUri(null);
    setErrors({});
  }

  async function handleSave() {
    if (!(await validate())) return;

    setSaving(true);
    try {
      const driverPayload = {
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
      };
      const savedDriver = isEditMode
        ? await driverRepository.update(driverId!, driverPayload)
        : await driverRepository.create(driverPayload);

      // Step 2: Upload photo using the newly created driver's ID
      if (photoUri && savedDriver?.id) {
        setUploadingPhoto(true);
        try {
          const uploadResult = await uploadDriverPhoto(savedDriver.id, photoUri);
          // The backend uploadController updates Firestore with photoURL automatically.
          // Sync the local cache immediately so the driver list shows the photo.
          if (uploadResult?.photoURL) {
            await collectionCache.updateInCollection('drivers', savedDriver.id, {
              photoURL: uploadResult.photoURL,
            } as any);
          }
        } catch (err: any) {
          // Photo upload failed but driver was created successfully
          Alert.alert(
            'Driver Created',
            'The driver was created but the photo could not be uploaded. You can add a photo later.'
          );
        }
        setUploadingPhoto(false);
      }

      Alert.alert('Success', `Driver ${isEditMode ? 'updated' : 'created'} successfully`);
      if (isEditMode) {
        router.replace(`/management/drivers/${driverId}` as any);
      } else {
        resetForm();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create driver';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  }

  const vendorOptions = vendors.map((v) => ({
    id: v.id,
    name: v.companyName || (v as any).name || 'Unknown Vendor',
  }));

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>{isEditMode ? 'Edit Driver' : 'Onboard Driver'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditMode ? 'Edit Driver' : 'Onboard Driver'}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isEditMode ? 'Update driver information. Insurance and compliance are inherited from the assigned vendor.' : 'Add a new driver to the system. Insurance & compliance are inherited from the assigned vendor.'}
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
                <Image source={{ uri: photoUri }} style={styles.photoPreviewLarge} resizeMode="cover" />
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
                <Ionicons name="camera-outline" size={20} color={photoUri ? '#10B981' : colors.primary} />
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
            onBlur={checkNationalId}
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
            title={isEditMode ? 'Save Changes' : 'Create Driver'}
            onPress={handleSave}
            icon="checkmark-circle"
            style={styles.actionBtn}
            loading={saving || uploadingPhoto || loadingDriver}
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
  photoSectionCard: { marginBottom: Spacing.md, paddingTop: Spacing.sm },
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
  photoSectionTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  photoStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  photoStatusText: { fontSize: 11, fontWeight: '700' },
  photoSectionSub: { fontSize: 13, marginBottom: Spacing.md },
  photoPreviewWrap: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    backgroundColor: '#F1F5F9',
  },
  photoPreviewLarge: { width: '100%', height: '100%' },
  photoPreviewPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 13, fontWeight: '600', marginTop: 8 },
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
  photoPreviewOverlayText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 8 },
  photoActionsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
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
  photoBtnText: { fontSize: 13, fontWeight: '700' },
  photoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  photoRemoveText: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  actionBtn: { flex: 1 },
});
