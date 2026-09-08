import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import api from '../../services/api';
import { StackScreen } from '../../components/ui/StackScreen';
import { DataCard } from '../../components/EnterpriseUI';
import { useTheme } from '../../hooks/useTheme';

type SecurityPerson = { id: string; name: string; location: string; phone?: string; securityCode: string; isActive: boolean };

export default function SecurityPersonnelScreen() {
  const colors = useTheme();
  const [people, setPeople] = useState<SecurityPerson[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<SecurityPerson | null>(null);
  const savingRef = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api.get<SecurityPerson[]>('/api/track/security-personnel'); setPeople(response.data); }
    catch (e: any) { setError(e.message || 'Unable to load security personnel.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const save = async () => {
    if (savingRef.current) return;
    if (!name.trim() || !location.trim()) { setError('Enter the person’s name and assigned location.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try {
      const response = await api.post<SecurityPerson>('/api/track/security-personnel', { name: name.trim(), location: location.trim(), phone: phone.trim() });
      const person = response.data;
      setPeople((current) => [...current, person].sort((a, b) => a.name.localeCompare(b.name)));
      setCreated(person); setName(''); setLocation(''); setPhone('');
    } catch (e: any) { setError(e.message || 'Unable to add security personnel.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <StackScreen title="Security personnel" subtitle="Tracking access by security code" fallbackHref="/management/dashboard">
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.textMuted }}>Add the person’s details and assigned location. They use their security code on Tracking to check vehicles.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      {created ? <DataCard><Text style={{ color: colors.text }}>Added {created.name} · {created.location}</Text><Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: '700' }}>Security code: {created.securityCode}</Text></DataCard> : null}
      <DataCard>
        <View style={{ gap: 12 }}>
          <TextInput label="Full name" value={name} onChangeText={setName} mode="outlined" disabled={saving} />
          <TextInput label="Assigned location" value={location} onChangeText={setLocation} mode="outlined" disabled={saving} />
          <TextInput label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" mode="outlined" disabled={saving} />
          <Button mode="contained" loading={saving} disabled={saving || loading} onPress={() => { void save(); }}>Add security personnel</Button>
        </View>
      </DataCard>
      <Button loading={loading} disabled={loading || saving} onPress={() => { void load(); }}>Refresh personnel</Button>
      {!loading && !error && !people.length ? <Text style={{ color: colors.textMuted }}>No security personnel added yet.</Text> : null}
      {people.map((person) => <DataCard key={person.id}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{person.name}</Text>
        <Text style={{ color: colors.textMuted }}>{person.location}</Text>
        {person.phone ? <Text style={{ color: colors.textMuted }}>{person.phone}</Text> : null}
        <Text selectable style={{ color: colors.primary, fontWeight: '700', fontSize: 20 }}>{person.securityCode}</Text>
        <Text style={{ color: colors.textMuted }}>{person.isActive ? 'Active' : 'Inactive'}</Text>
      </DataCard>)}
    </View>
  </StackScreen>;
}
