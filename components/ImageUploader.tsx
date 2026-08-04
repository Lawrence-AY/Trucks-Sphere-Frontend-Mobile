import { useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Card, Text, TouchableRipple } from 'react-native-paper';
import type { UploadResult } from '../services/uploadService';

interface ImageUploaderProps {
  photoURL: string | null | undefined;
  uploadFn: (fileUri: string) => Promise<UploadResult>;
  label: string;
  size?: number;
  onUploaded?: (url: string) => void;
}

export default function ImageUploader({ photoURL, uploadFn, label, size = 100, onUploaded }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const displayUrl = preview || photoURL || null;

  const upload = async (fileUri: string, successMessage: string) => {
    setPreview(fileUri);
    setUploading(true);
    try {
      const uploadResult = await uploadFn(fileUri);
      if (uploadResult.success && uploadResult.photoURL) {
        setPreview(uploadResult.photoURL);
        onUploaded?.(uploadResult.photoURL);
        Alert.alert('Success', successMessage);
      }
    } catch (error: any) {
      Alert.alert('Upload Error', error?.response?.data?.error || error?.message || 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handlePick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to select a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) await upload(result.assets[0].uri, `${label} uploaded successfully.`);
  };

  const handleCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) await upload(result.assets[0].uri, `${label} captured and uploaded successfully.`);
  };

  return (
    <Card mode="outlined" style={styles.card} contentStyle={styles.content}>
      <Text variant="titleSmall">{label}</Text>
      <TouchableRipple onPress={handlePick} disabled={uploading} borderless style={[styles.thumbnailTouchable, { width: size, height: size }]}>
        <View style={[styles.thumbnail, { width: size, height: size }]}>
          {uploading ? <ActivityIndicator size="large" /> : displayUrl ? <Image source={{ uri: displayUrl }} style={{ width: size, height: size }} resizeMode="cover" /> : <>
            <Ionicons name="camera-outline" size={32} color="#94A3B8" />
            <Text variant="labelSmall" style={styles.placeholderText}>No photo</Text>
          </>}
        </View>
      </TouchableRipple>
      <View style={styles.actions}>
        <Button mode="outlined" compact onPress={handlePick} disabled={uploading} icon={({ color, size: iconSize }) => <Ionicons name="image-outline" size={iconSize} color={color} />}>Gallery</Button>
        <Button mode="outlined" compact onPress={handleCamera} disabled={uploading} icon={({ color, size: iconSize }) => <Ionicons name="camera-outline" size={iconSize} color={color} />}>Camera</Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', width: '100%', maxWidth: 280 },
  content: { alignItems: 'center', gap: 10, padding: 14 },
  thumbnailTouchable: { borderRadius: 16, overflow: 'hidden' },
  thumbnail: { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', gap: 4 },
  placeholderText: { color: '#94A3B8', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
});
