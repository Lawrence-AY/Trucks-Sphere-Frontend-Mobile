import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { Spacing, Radius } from '../../constants/theme';
import { DataCard, DetailRow, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { getRoleLabel } from '../../utils/helpers';
import { changePassword } from '../../services/api';

export default function ManagementProfileScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();

  // Password change form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async () => {
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      Alert.alert('Success', 'Your password has been updated successfully.');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to change password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      {/* Profile Card */}
      <DataCard>
        <View style={{ alignItems: 'center', gap: Spacing.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#1B2A4A18',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#1B2A4A' }}>
              {(user?.displayName || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            {user?.displayName || 'User'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            {user?.email || ''}
          </Text>
        </View>
      </DataCard>

      {/* Account Details */}
      <SectionTitle title="Account details" />
      <DataCard>
        <DetailRow icon="person-outline" label="Name" value={user?.displayName || 'N/A'} />
        <DetailRow icon="mail-outline" label="Email" value={user?.email || 'N/A'} />
        <DetailRow icon="shield-checkmark-outline" label="Role" value={getRoleLabel(user?.role || '')} />
        <DetailRow icon="call-outline" label="Phone" value={user?.phone || 'Not set'} />
        <DetailRow
          icon="calendar-outline"
          label="Member since"
          value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
        />
      </DataCard>

      {/* Change Password Section */}
      <SectionTitle title="Security" />
      <DataCard>
        {!showPasswordForm ? (
          <TouchableOpacity
            style={[styles.changePwdBtn, { borderColor: colors.border }]}
            onPress={() => setShowPasswordForm(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.changePwdBtnText, { color: colors.textSecondary }]}>
              Change Password
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.passwordForm}>
            <Text style={[styles.formTitle, { color: colors.text }]}>Update Password</Text>

            {/* Current Password */}
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              Current Password
            </Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Enter current password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={currentPassword}
              onChangeText={(v) => {
                setCurrentPassword(v);
                setError('');
              }}
              autoFocus
            />

            {/* New Password */}
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              New Password
            </Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Min 8 characters"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={newPassword}
              onChangeText={(v) => {
                setNewPassword(v);
                setError('');
              }}
            />

            {/* Confirm Password */}
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              Confirm New Password
            </Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                setError('');
              }}
            />

            {/* Error message */}
            {error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            ) : null}

            {/* Action buttons */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setShowPasswordForm(false);
                  setError('');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={submitting}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 },
                ]}
                onPress={handleChangePassword}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.submitBtnText}>
                  {submitting ? 'Updating...' : 'Update Password'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </DataCard>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  changePwdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  changePwdBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  passwordForm: {
    gap: Spacing.sm,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 2,
    minHeight: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});