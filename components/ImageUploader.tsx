/**
 * ImageUploader Component
 *
 * Reusable component for capturing/selecting images and uploading them
 * to Firebase Storage via the backend API.
 *
 * Props:
 *   - photoURL: string | null — current photo URL to display
 *   - uploadFn: (fileUri: string) => Promise<UploadResult> — upload function
 *   - label: string — label text (e.g. "Driver Photo", "Delivery Note")
 *   - size?: number — thumbnail size (default: 100)
 *   - onUploaded?: (url: string) => void — callback with new photoURL
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { UploadResult } from '../services/uploadService';

interface ImageUploaderProps {
  photoURL: string | null | undefined;
  uploadFn: (fileUri: string) => Promise<UploadResult>;
  label: string;
  size?: number;
  onUploaded?: (url: string) => void;
}

export default function ImageUploader({
  photoURL,
  uploadFn,
  label,
  size = 100,
  onUploaded,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const displayUrl = preview || photoURL || null;

  const handlePick = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Camera roll access is required to select a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const fileUri = result.assets[0].uri;
      setPreview(fileUri);
      setUploading(true);

      const uploadResult = await uploadFn(fileUri);

      if (uploadResult.success && uploadResult.photoURL) {
        setPreview(uploadResult.photoURL);
        onUploaded?.(uploadResult.photoURL);
        Alert.alert('Success', `${label} uploaded successfully.`);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Upload failed';
      Alert.alert('Upload Error', msg);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const fileUri = result.assets[0].uri;
      setPreview(fileUri);
      setUploading(true);

      const uploadResult = await uploadFn(fileUri);

      if (uploadResult.success && uploadResult.photoURL) {
        setPreview(uploadResult.photoURL);
        onUploaded?.(uploadResult.photoURL);
        Alert.alert('Success', `${label} captured & uploaded successfully.`);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Upload failed';
      Alert.alert('Upload Error', msg);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        onPress={handlePick}
        disabled={uploading}
        activeOpacity={0.7}
        style={styles.thumbnailTouchable}
      >
        {uploading ? (
          <View style={[styles.thumbnail, { width: size, height: size }]}>
            <ActivityIndicator size="large" color="#1B2A4A" />
          </View>
        ) : displayUrl ? (
          <View style={[styles.thumbnail, { width: size, height: size }]}>
            <Image
              source={{ uri: displayUrl }}
              style={{ width: size, height: size }}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View style={[styles.placeholder, { width: size, height: size }]}>
            <Ionicons name="camera-outline" size={32} color="#94A3B8" />
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handlePick} disabled={uploading}>
          <Ionicons name="image-outline" size={18} color="#1B2A4A" />
          <Text style={styles.actionText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCamera} disabled={uploading}>
          <Ionicons name="camera-outline" size={18} color="#1B2A4A" />
          <Text style={styles.actionText}>Camera</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  thumbnailTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  thumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  placeholderText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B2A4A',
  },
});