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
import { useAuthStore } from '@/store/authStore';
import { Gap, Radius, Spacing } from '../../constants/theme';
import { DataCard, DetailRow, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { getRoleLabel } from '../../utils/helpers';
import { getPasswordChangeError, PASSWORD_REQUIREMENTS } from '../../utils/passwordPolicy';
import { changePassword, updateProfile } from '../../services/api';
import { AccountDeletionRequest } from '../../components/AccountDeletionRequest';

export default function ManagementProfileScreen() {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const { user } = useAuthStore();

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(user?.displayName || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password change form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pwError, setPwError] = useState('');

  const handleSaveProfile = async () => {
    if (!editDisplayName.trim()) {
      setProfileError('Display name is required.');
      return;
    }
    setSavingProfile(true);
    setProfileError('');
    try {
      const result = await updateProfile({
        displayName: editDisplayName.trim(),
        phone: editPhone.trim() || undefined,
      
      });
      // Update the local auth store
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, displayName: editDisplayName.trim(), phone: editPhone.trim() } : null,
      }));
      Alert.alert('Success', 'Profile updated successfully.');
      setEditingProfile(false);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    const passwordError = getPasswordChangeError(currentPassword, newPassword, confirmPassword);
    if (passwordError) {
      setPwError(passwordError);
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
      setPwError(err?.message || 'Failed to change password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      {/* Profile Card */}
      <DataCard>
        <View style={{ alignItems: 'center', gap: Gap}}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primaryText }}>
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

        {/* Edit Profile Button */}
        {!editingProfile ? (
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.primary, marginTop: Spacing.xs}]}
            onPress={() => { setEditingProfile(true); setEditDisplayName(user?.displayName || ''); setEditPhone(user?.phone || ''); setEditEmail(user?.email || ''); setProfileError(''); }}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={16} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontSize: 13, fontWeight: '700' }}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: Gap, marginTop: Spacing.xs}}>
            {profileError ? <Text style={[styles.errorText, { color: colors.danger }]}>{profileError}</Text> : null}
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Display Name</Text>
            <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              placeholder="Your display name"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Phone</Text>
            <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
            />
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Email</Text>
            <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Your email address"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: Gap}}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { setEditDisplayName(user?.displayName || ''); setEditPhone(user?.phone || ''); setEditEmail(user?.email || ''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); (() => { setEditingProfile(false); setProfileError(''); })(); }}
                disabled={savingProfile}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: savingProfile ? 0.6 : 1 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Ionicons name="checkmark-outline" size={16} color={colors.onPrimary} />}
                <Text style={{ color: colors.onPrimary, fontSize: 13, fontWeight: '700' }}>{savingProfile ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </DataCard>

      {/* Account Details */}
      <SectionTitle title="Account details" />
      <DataCard>
        <DetailRow icon="person-outline" label="Name" value={user?.displayName || 'N/A'} />
    
        <DetailRow icon="shield-checkmark-outline" label="Role" value={getRoleLabel(user?.role || '')} />
        <DetailRow icon="call-outline" label="Phone" value={user?.phone || 'Not set'} />
        <DetailRow
          icon="calendar-outline"
          label="Member since"
          value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' }) : 'N/A'}
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

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              Current Password
            </Text>
            <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Enter current password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={currentPassword}
              onChangeText={(v) => { setCurrentPassword(v); setPwError(''); }}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              New Password
            </Text>
            <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Enter a strong new password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setPwError(''); }}
            />
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{PASSWORD_REQUIREMENTS}</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              Confirm New Password
            </Text>
            <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setPwError(''); }}
            />

            {pwError ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{pwError}</Text>
            ) : null}

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { setEditDisplayName(user?.displayName || ''); setEditPhone(user?.phone || ''); setEditEmail(user?.email || ''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); (() => {
                  setShowPasswordForm(false);
                  setPwError('');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                })(); }}
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
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.onPrimary} />
                )}
                <Text style={styles.submitBtnText}>
                  {submitting ? 'Updating...' : 'Update Password'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </DataCard>
      <AccountDeletionRequest />
    </PageShell>
  );
}

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Gap,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
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
  changePwdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap,
    paddingVertical: Spacing.sm,
  },
  changePwdBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  passwordForm: {
    gap: Gap,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800', marginBottom: Spacing.xs,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    gap: Gap, marginTop: Spacing.xs,
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
    gap: Gap,
  },
  submitBtnText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
