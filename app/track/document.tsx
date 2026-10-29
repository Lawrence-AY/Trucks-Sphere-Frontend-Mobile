import { useState } from 'react';
import { Alert, Button, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getItem } from '../../services/database';
import { createPendingGatePass, uploadPendingGatePassPhoto } from '../../services/api';

const SESSION_KEY = 'user_track';
type Photo = { uri: string; mimeType?: string | null; fileName?: string | null };

export default function DocumentGatePassScreen() {
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [truckPhoto, setTruckPhoto] = useState<Photo | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<Photo | null>(null);
  const [saving, setSaving] = useState(false);
  const capture = async (setter: (photo: Photo) => void) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission needed', 'Camera access is required.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setter({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType, fileName: result.assets[0].fileName });
  };
  const submit = async () => {
    if (!truckNumber.trim() || !driverName.trim() || !truckPhoto || !driverPhoto) return Alert.alert('Incomplete', 'Enter the truck and driver, then capture both photos.');
    setSaving(true);
    try {
      const session = JSON.parse((await getItem(SESSION_KEY)) || 'null');
      if (!session?.id || !session?.token) throw new Error('Start a security session first from /track.');
      const pending = await createPendingGatePass(session.id, session.token, truckNumber, driverName);
      await uploadPendingGatePassPhoto(session.id, session.token, pending.id, 'truck', truckPhoto);
      await uploadPendingGatePassPhoto(session.id, session.token, pending.id, 'driver', driverPhoto);
      Alert.alert('Saved', 'The pending gate pass will attach automatically when the truck creates a delivery job.');
      setTruckNumber(''); setDriverName(''); setTruckPhoto(null); setDriverPhoto(null);
    } catch (error: any) { Alert.alert('Could not save', error?.response?.data?.error || error.message || 'Please try again.'); }
    finally { setSaving(false); }
  };
  return <ScrollView contentContainerStyle={styles.root}><Text style={styles.title}>Document unregistered truck</Text><Text style={styles.help}>Use this independent security document route when the truck is not found.</Text><TextInput style={styles.input} placeholder="Truck number" value={truckNumber} onChangeText={setTruckNumber} autoCapitalize="characters"/><TextInput style={styles.input} placeholder="Driver name" value={driverName} onChangeText={setDriverName}/><Button title={truckPhoto ? 'Retake truck photo' : 'Capture truck photo'} onPress={() => capture(setTruckPhoto)} /><>{truckPhoto && <Image source={{ uri: truckPhoto.uri }} style={styles.photo} />}</><Button title={driverPhoto ? 'Retake driver photo' : 'Capture driver photo'} onPress={() => capture(setDriverPhoto)} /><>{driverPhoto && <Image source={{ uri: driverPhoto.uri }} style={styles.photo} />}</><View style={styles.submit}><Button title={saving ? 'Saving...' : 'Create pending gate pass'} onPress={submit} disabled={saving} /></View></ScrollView>;
}
const styles = StyleSheet.create({ root: { padding: 24, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' }, title: { fontSize: 24, fontWeight: '800' }, help: { color: '#64748B' }, input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 14, fontSize: 16 }, photo: { width: '100%', height: 220, borderRadius: 10, backgroundColor: '#E2E8F0' }, submit: { marginTop: 12 } });
