import { useRef, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { vehicleRepository } from '../services/repositories/VehicleRepository';
import { useRealTimeSyncStore } from '../store/realTimeSyncStore';
import { Vehicle } from '../store/types';

export function EditVehicleModal({ vehicle, onClose, onSaved }: { vehicle: Vehicle; onClose: () => void; onSaved: (vehicle: Vehicle) => void }) {
  const colors = useTheme();
  const [plate, setPlate] = useState(vehicle.registrationNumber || (vehicle as any).plateNumber || '');
  const [make, setMake] = useState(vehicle.make || '');
  const [model, setModel] = useState(vehicle.model || '');
  const [capacity, setCapacity] = useState(String(vehicle.capacity ?? ''));
  const [status, setStatus] = useState(vehicle.status || 'active');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (busy.current) return;
    const registrationNumber = plate.trim().replace(/\s+/g, '').toUpperCase();
    if (!registrationNumber || !capacity.trim() || !Number.isFinite(Number(capacity)) || Number(capacity) <= 0) {
      setError('Enter a plate number and a positive capacity.'); return;
    }
    busy.current = true; setSaving(true); setError('');
    try {
      const saved = await vehicleRepository.update(vehicle.id, { registrationNumber, make: make.trim(), model: model.trim(), capacity: Number(capacity), status });
      useRealTimeSyncStore.getState().optimisticUpdate('vehicles', saved);
      onSaved(saved);
      onClose();
    } catch (err: any) { setError(err?.response?.data?.error || err?.response?.data?.message || 'Could not update the vehicle. Try again.'); }
    finally { busy.current = false; setSaving(false); }
  };
  return <Modal transparent animationType="slide" visible onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: 20 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 12 }}>Edit Vehicle</Text>
        <ScrollView keyboardShouldPersistTaps="handled">
          {[
            { label: 'Plate Number', value: plate, set: setPlate }, { label: 'Make', value: make, set: setMake },
            { label: 'Model', value: model, set: setModel }, { label: `Capacity (${vehicle.capacityUnit || 'tonnes'})`, value: capacity, set: setCapacity },
          ].map(field => <View key={field.label} style={{ marginBottom: 14 }}><Text style={{ color: colors.text }}>{field.label}</Text><TextInput accessibilityLabel={field.label} editable={!saving} value={field.value} onChangeText={field.set} keyboardType={field.set === setCapacity ? 'decimal-pad' : 'default'} style={{ color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 6 }} /></View>)}
          <Text style={{ color: colors.text, marginBottom: 8 }}>Status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['active', 'inactive', 'on_trip', 'in_maintenance', 'out_of_service'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: status === value }} disabled={saving} onPress={() => setStatus(value)} style={{ padding: 10, borderRadius: 8, backgroundColor: status === value ? colors.primary : colors.background }}><Text style={{ color: status === value ? colors.onPrimary : colors.text }}>{value.replace(/_/g, ' ')}</Text></TouchableOpacity>)}</View>
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginTop: 12 }}>{error}</Text> : null}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}><TouchableOpacity disabled={saving} onPress={onClose} style={{ padding: 12 }}><Text style={{ color: colors.text }}>Cancel</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={saving} onPress={() => void save()} style={{ padding: 12, borderRadius: 8, backgroundColor: colors.primary, flex: 1, alignItems: 'center', opacity: saving ? .5 : 1 }}><Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{saving ? 'Saving…' : 'Save vehicle'}</Text></TouchableOpacity></View>
      </View>
    </View>
  </Modal>;
}
