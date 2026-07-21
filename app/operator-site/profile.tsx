import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { Spacing, Radius } from '../../constants/theme';
import { DataCard, DetailRow, PageShell, SectionTitle } from '../../components/EnterpriseUI';
import { getRoleLabel } from '../../utils/helpers';
import { changePassword, updateProfile } from '../../services/api';

export default function OperatorSiteProfileScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(user?.displayName || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password change state
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
      await updateProfile({
        displayName: editDisplayName.trim(),
        phone: editPhone.trim() || undefined,
      });
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
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing['4xl'] }} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <DataCard>
          <View style={{ alignItems: 'center', gap: Spacing.md }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#1B2A4A18', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#1B2A4A' }}>{(user?.displayName || 'S').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.displayName || 'Site Operator'}</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email || ''}</Text>
          </View>

          {!editingProfile ? (
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.primary, marginTop: Spacing.md }]}
              onPress={() => { setEditingProfile(true); setEditDisplayName(user?.displayName || ''); setEditPhone(user?.phone || ''); setProfileError(''); }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
              {profileError ? <Text style={[styles.errorText, { color: colors.danger }]}>{profileError}</Text> : null}
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Display Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
                value={editDisplayName}
                onChangeText={setEditDisplayName}
                placeholder="Your display name"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Phone</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Phone number"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
              />
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setEditingProfile(false); setProfileError(''); }}
                  disabled={savingProfile}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: savingProfile ? 0.6 : 1 }]}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-outline" size={16} color="#FFF" />}
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{savingProfile ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </DataCard>

        {/* Account Details */}
        <SectionTitle title="Account details" />
        <DataCard>
          <DetailRow icon="person-outline" label="Name" value={user?.displayName || 'N/A'} />
          <DetailRow icon="mail-outline" label="Email" value={user?.email || 'N/A'} />
          <DetailRow icon="shield-checkmark-outline" label="Role" value={getRoleLabel(user?.role || '')} />
          <DetailRow icon="call-outline" label="Phone" value={user?.phone || 'Not set'} />
          <DetailRow icon="location-outline" label="Site ID" value={user?.siteId || 'N/A'} />
        </DataCard>

        {/* Change Password */}
        <SectionTitle title="Security" />
        <DataCard>
          {!showPasswordForm ? (
            <TouchableOpacity
              style={[styles.changePwdBtn, { borderColor: colors.border }]}
              onPress={() => setShowPasswordForm(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.changePwdBtnText, { color: colors.textSecondary }]}>Change Password</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.passwordForm}>
              <Text style={[styles.formTitle, { color: colors.text }]}>Update Password</Text>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Current Password</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Enter current password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={currentPassword}
                onChangeText={(v) => { setCurrentPassword(v); setPwError(''); }}
                autoFocus
              />
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>New Password</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Min 6 characters"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={newPassword}
                onChangeText={(v) => { setNewPassword(v); setPwError(''); }}
              />
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setPwError(''); }}
              />
              {pwError ? <Text style={[styles.errorText, { color: colors.danger }]}>{pwError}</Text> : null}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setShowPasswordForm(false); setPwError(''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  disabled={submitting}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
                  onPress={handleChangePassword}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
                  <Text style={styles.submitBtnText}>{submitting ? 'Updating...' : 'Update Password'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </DataCard>
      </ScrollView>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderRadius: Radius.md,
  },
  inputLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { height: 46, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, fontSize: 14, fontWeight: '600' },
  changePwdBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  changePwdBtnText: { flex: 1, fontSize: 14, fontWeight: '700' },
  passwordForm: { gap: Spacing.sm },
  formTitle: { fontSize: 15, fontWeight: '800', marginBottom: Spacing.xs },
  errorText: { fontSize: 12, fontWeight: '700' },
  formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: { flex: 1, minHeight: 44, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },
  submitBtn: { flex: 2, minHeight: 44, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});