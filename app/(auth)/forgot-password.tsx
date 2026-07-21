import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { requestPasswordReset } from '../../services/api';
import { Radius, Spacing } from '../../constants/theme';

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    if (!identifier.trim()) { setError('Enter your email address or username.'); return; }
    setSubmitting(true); setError('');
    try {
      await requestPasswordReset(identifier.trim());
      setMessage('If an account matches those details, a reset link has been sent. Check your email.');
    } catch (err: any) { setError(err.message || 'Unable to request a reset. Please try again.'); }
    finally { setSubmitting(false); }
  };

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.panel}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color="#1B2A4A" /></TouchableOpacity>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Enter your registered email address or username. We’ll send a secure reset link if an account matches.</Text>
      <Text style={styles.label}>Email or username</Text>
      <TextInput style={styles.input} value={identifier} onChangeText={(value) => { setIdentifier(value); setError(''); }} autoCapitalize="none" autoCorrect={false} editable={!submitting} placeholder="you@example.com or username" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <TouchableOpacity style={[styles.button, submitting && { opacity: 0.65 }]} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset link</Text>}
      </TouchableOpacity>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.xl, backgroundColor: '#F0F2F5' },
  panel: { backgroundColor: '#fff', borderRadius: 20, padding: Spacing.xl, borderWidth: 1, borderColor: '#E2E8F0', maxWidth: 440, width: '100%', alignSelf: 'center' },
  back: { width: 36, height: 36, justifyContent: 'center' },
  title: { color: '#1E293B', fontSize: 22, fontWeight: '800', marginTop: Spacing.sm },
  subtitle: { color: '#64748B', fontSize: 14, lineHeight: 20, marginTop: Spacing.sm, marginBottom: Spacing.xl },
  label: { color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: Spacing.xs },
  input: { height: 48, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: Radius.md, paddingHorizontal: Spacing.md, color: '#1E293B' },
  error: { color: '#DC2626', fontSize: 13, marginTop: Spacing.sm }, success: { color: '#047857', fontSize: 13, lineHeight: 18, marginTop: Spacing.sm },
  button: { height: 48, marginTop: Spacing.xl, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B2A4A' }, buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
