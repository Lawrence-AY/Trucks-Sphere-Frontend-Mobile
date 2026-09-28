import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { requestAccountDeletion } from '../services/api';
import { useAuthStore } from '@/store/authStore';
import { showAlert, showAlertWithCallback, showConfirm } from '../utils/webAlert';

const DELETION_SUPPORT_EMAIL = 'support@trucksphere.app';

export function AccountDeletionRequest() {
  const colors = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const [submitting, setSubmitting] = useState(false);

  const scheduleDeletion = async () => {
    const confirmed = await showConfirm(
      'Schedule account deletion?',
      'Your sign-in credentials and Truck Sphere profile will be deleted after a 21-day recovery period. Signing in again before then cancels the request. Delivery, weighbridge, fuel, and audit records may be retained when required for contractual, tax, safety, or legal obligations; these records are not an active account and cannot be used to sign in. Contact support if you have questions.',
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const { scheduledFor } = await requestAccountDeletion();
      const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(scheduledFor));
      await showAlertWithCallback(
        'Deletion scheduled',
        `Your account is scheduled for deletion on ${date}. You will now be signed out. Sign in again before that date to keep your account.`,
        () => { void logout(); },
      );
    } catch (error: any) {
      await showAlert('Unable to schedule deletion', error?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${colors.danger}80` }]}>
      <View style={styles.header}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
        <Text style={[styles.title, { color: colors.danger }]}>Delete account</Text>
      </View>
      <Text style={[styles.description, { color: colors.textMuted }]}>Your sign-in credentials and Truck Sphere profile are deleted after a 21-day recovery period. Signing in before that date cancels the request.</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>Delivery, weighbridge, fuel, and audit records may be retained when required for contractual, tax, safety, or legal obligations. Retained records do not keep your account active or allow sign-in.</Text>
       <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Schedule account deletion"
        disabled={submitting}
        onPress={scheduleDeletion}
        style={[styles.button, { borderColor: colors.danger }, submitting && styles.disabled]}
      >
        {submitting ? <ActivityIndicator color={colors.danger} size="small" /> : <Text style={[styles.buttonText, { color: colors.danger }]}>Schedule account deletion</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: 15, fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 19 },
  supportText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  button: { minHeight: 44, borderWidth: 1, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  buttonText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.65 },
});
