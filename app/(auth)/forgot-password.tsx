import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { router } from '../../utils/router';
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Card mode="outlined" style={styles.panel} contentStyle={styles.panelContent}>
        <IconButton icon="arrow-left" onPress={() => router.back()} style={styles.back} />
        <Text variant="headlineSmall" style={styles.title}>Reset password</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>Enter your registered email address or username. We’ll send a secure reset link if an account matches.</Text>
        <TextInput mode="outlined" label="Email or username" value={identifier} onChangeText={(value) => { setIdentifier(value); setError(''); }} autoCapitalize="none" autoCorrect={false} disabled={submitting} placeholder="you@example.com or username" />
        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        {message ? <HelperText type="info" visible>{message}</HelperText> : null}
        <Button mode="contained" onPress={submit} loading={submitting} disabled={submitting} style={styles.button} contentStyle={styles.buttonContent}>Send reset link</Button>
      </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  panel: { borderRadius: Radius.xl, maxWidth: 440, width: '100%', alignSelf: 'center' },
  panelContent: { padding: Spacing.xl },
  back: { marginLeft: -Spacing.sm },
  title: { fontWeight: '800', marginTop: Spacing.xs},
  subtitle: { lineHeight: 20, marginTop: Spacing.xs, marginBottom: Spacing.xs},
  button: { marginTop: Spacing.xs},
  buttonContent: { height: 48 },
});
