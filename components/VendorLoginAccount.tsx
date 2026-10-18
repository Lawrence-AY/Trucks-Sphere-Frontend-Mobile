import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useTheme } from '../hooks/useTheme';
import { vendorRepository } from '../services/repositories/VendorRepository';
import { generateStrongPassword, getStrongPasswordError } from '../utils/passwordPolicy';
import type { Vendor } from '@/store/types';

export function VendorLoginAccount({ vendor, onCreated }: { vendor: Vendor; onCreated: (vendor: Vendor) => void }) {
  const colors = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function create() {
    if (saving) return;
    const invalid = getStrongPasswordError(password);
    if (invalid || password !== confirm) { setError(invalid || 'Passwords do not match.'); return; }
    setSaving(true); setError('');
    try {
      const result = await vendorRepository.createAccount(vendor.id, { password, isActive: true });
      setUsername(result.username); setPassword(''); setConfirm(''); onCreated(result.vendor);
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Unable to create login account.'); }
    finally { setSaving(false); }
  }
  return <Card>
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Vendor login account</Text>
      {username || (vendor as any).userId ? <Text style={{ color: colors.text }}>{username ? `Login created. Username: ${username}` : 'This vendor has a linked login account.'}</Text> : <>
        <Text style={{ color: colors.textMuted }}>Create a username login linked to this vendor and their existing records.</Text>
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry required />
        <Input label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry required />
        <Button title="Suggest strong password" variant="secondary" disabled={saving} onPress={() => { const value = generateStrongPassword(); setPassword(value); setConfirm(value); }} />
        <Button title="Create Login Account" onPress={create} loading={saving} disabled={saving} />
      </>}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
    </View>
  </Card>;
}
