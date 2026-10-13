import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import api from '../../services/api';
import { StackScreen } from '../../components/ui/StackScreen';
import { DataCard } from '../../components/EnterpriseUI';
import { useTheme } from '../../hooks/useTheme';
import { Gap } from '../../constants/theme';

type SecurityPerson = {
  id: string;
  name: string;
  location: string;
  phone?: string;
  securityCode: string;
  isActive: boolean;
};
const SECURITY_LOCATIONS = ['gate', 'checkpoint 1', 'checkpoint 2', 'checkpoint 3'];

export default function SecurityPersonnelScreen() {
  const colors = useTheme();
  const router = useRouter();

  const [people, setPeople] = useState<SecurityPerson[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<SecurityPerson | null>(null);

  const savingRef = useRef(false);

  // Load personnel from API
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<SecurityPerson[]>('/api/track/security-personnel');
      setPeople(response.data);
    } catch (e: any) {
      setError(e.message || 'Unable to load security personnel.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Add new person
  const save = async () => {
    if (savingRef.current) return;
    if (!name.trim() || !location.trim()) {
      setError('Enter the person’s name and assigned location.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError('');

    try {
      const response = await api.post<SecurityPerson>('/api/track/security-personnel', {
        name: name.trim(),
        location: location.trim(),
        phone: phone.trim(),
      });
      const person = response.data;
      setPeople((current) => [...current, person].sort((a, b) => a.name.localeCompare(b.name)));
      setCreated(person);
      setName('');
      setLocation('');
      setPhone('');
    } catch (e: any) {
      setError(e.message || 'Unable to add security personnel.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Clear all personnel (local state)
  const clearAll = () => {
    setPeople([]);
  };

  const resetForm = () => {
    setName('');
    setLocation('');
    setPhone('');
    setError('');
    setCreated(null);
    setShowLocationOptions(false);
  };

  return (
    <>
      {/* Header with back button */}
      <Stack.Screen
        options={{
          title: 'Security Personnel',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerLeft: () => (
            <Button
              onPress={() => {
                resetForm();
                router.back();
              }}
              compact
              labelStyle={{ color: colors.primary }}
            >
              ← Back
            </Button>
          ),
        }}
      />

      <View style={{ flex: 1, gap: Gap, padding: 12, backgroundColor: colors.background }}>
        {/* Top section: description, errors, creation feedback, form */}
        <View style={{ gap: Gap }}>
          <Text style={{ color: colors.textMuted }}>
            Add the person’s details and assigned location.
          </Text>

          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : null}

          {created ? (
            <DataCard>
              <Text style={{ color: colors.text }}>
                Added {created.name} · {created.location}
              </Text>
              <Text selectable style={{ color: colors.primaryText, fontSize: 24, fontWeight: '700' }}>
                Security code: {created.securityCode}
              </Text>
            </DataCard>
          ) : null}

          <DataCard>
            <View style={{ gap: Gap }}>
              <TextInput
                inputAccessoryViewID="trucksphere-keyboard-done"
                textColor={colors.text}
                outlineColor={colors.border}
                activeOutlineColor={colors.primaryText}
                style={{ backgroundColor: colors.inputBg }}
                label="Full name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                disabled={saving}
              />
              <Pressable onPress={() => setShowLocationOptions((visible) => !visible)} disabled={saving}>
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: colors.inputBg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: location ? colors.text : colors.textMuted, textTransform: 'capitalize' }}>{location || 'Assigned location'}</Text>
                  <Text style={{ color: colors.textMuted }}>{showLocationOptions ? '▲' : '▼'}</Text>
                </View>
              </Pressable>
              {showLocationOptions ? <View style={{ gap: Gap }}>
                {SECURITY_LOCATIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setLocation(option);
                      setShowLocationOptions(false);
                    }}
                    disabled={saving}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      backgroundColor: location === option ? colors.primary + '22' : colors.inputBg,
                    }}
                  >
                    <Text style={{ color: colors.text, textTransform: 'capitalize' }}>{option}</Text>
                  </Pressable>
                ))}
              </View> : null}
              <TextInput
                inputAccessoryViewID="trucksphere-keyboard-done"
                label="Phone (optional)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                mode="outlined"
                disabled={saving}
                style={{ backgroundColor: colors.inputBg }}
                outlineColor={colors.border}
                activeOutlineColor={colors.primaryText}
              />
              <Button
                mode="contained"
                loading={saving}
                disabled={saving || loading}
                onPress={() => {
                  void save();
                }}
                labelStyle={{ color: colors.onPrimary }}
              >
                Add security personnel
              </Button>
              <Button
                disabled={saving}
                onPress={() => {
                  resetForm();
                }}
                labelStyle={{ color: colors.text }}
              >
                Cancel
              </Button>
            </View>
          </DataCard>

          {!loading && !error && !people.length ? (
            <Text style={{ color: colors.textMuted }}>No security personnel added yet.</Text>
          ) : null}
        </View>

        {/* Scrollable list of personnel */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20, gap: Gap }}
          showsVerticalScrollIndicator
        >
          {people.map((person) => (
            <DataCard key={person.id}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{person.name}</Text>
              <Text style={{ color: colors.textMuted }}>{person.location}</Text>
              {person.phone ? <Text style={{ color: colors.textMuted }}>{person.phone}</Text> : null}
              <Text selectable style={{ color: colors.primaryText, fontWeight: '700', fontSize: 17 }}>
                {person.securityCode}
              </Text>
              <Text style={{ color: colors.textMuted }}>
                {person.isActive ? 'Active' : 'Inactive'}
              </Text>
            </DataCard>
          ))}
        </ScrollView>
      </View>
    </>
  );
}
