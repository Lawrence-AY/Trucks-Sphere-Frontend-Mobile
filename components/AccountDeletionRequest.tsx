import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gap, Radius, Spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { requestAccountDeletion } from '../services/api';
import { useAuthStore } from '@/store/authStore';
import { showAlert, showAlertWithCallback, showConfirm } from '../utils/webAlert';
import { accountDeletionCopy } from '../utils/accountDeletionCopy';

const DELETION_SUPPORT_EMAIL = 'support@trucksphere.app';

export function AccountDeletionRequest() {
  const colors = useTheme();
  const role = useAuthStore((state) => state.user?.role || '');
  const copy = accountDeletionCopy(role);
  const logout = useAuthStore((state) => state.logout);
  const [submitting, setSubmitting] = useState(false);

  const scheduleDeletion = async () => {
    const confirmed = await showConfirm(
      'Schedule account deletion?',
      `${copy.context} ${copy.recovery} ${copy.retention}`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const { scheduledFor } = await requestAccountDeletion();
      const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'Africa/Nairobi' }).format(new Date(scheduledFor));
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
      <Text style={[styles.description, { color: colors.textMuted }]}>{copy.context}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>{copy.recovery}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>{copy.retention}</Text>
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
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Gap},
  header: { flexDirection: 'row', alignItems: 'center', gap: Gap},
  title: { fontSize: 15, fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 19 },
  supportText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  button: { minHeight: 44, borderWidth: 1, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  buttonText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.65 },
});
