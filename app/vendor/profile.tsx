import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
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
import {
  CommandHeader,
  DataCard,
  DetailRow,
  PageShell,
  SectionTitle,
} from '../../components/EnterpriseUI';
import { getRoleLabel } from '../../utils/helpers';
import { updateProfile, changePassword } from '../../services/api';

export default function VendorProfileScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();

  // ─── Edit Profile State ───
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);

  // ─── Change Password State ───
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Validation', 'Display name is required.');
      return;
    }
    setProfileSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      Alert.alert('Success', 'Profile updated successfully.');
      setEditingProfile(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Validation', 'All password fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Validation', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation', 'New password and confirm password do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      Alert.alert('Success', 'Password changed successfully.');
      setChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <PageShell>
      <CommandHeader
        eyebrow="Account"
        title="Profile & Settings"
        subtitle={`${getRoleLabel(user?.role || '')} · ${user?.displayName || 'User'}`}
      />

      {/* Avatar */}
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
              {(user?.displayName || 'V').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            {user?.displayName || 'Vendor'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email || ''}</Text>
        </View>
      </DataCard>

      {/* Edit Profile Section */}
      <SectionTitle title="Profile Details" />
      <DataCard>
        {editingProfile ? (
          <>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Display Name</Text>
              <TextInput
                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Phone</Text>
              <TextInput
                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Email</Text>
              <TextInput
                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editCancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setEditingProfile(false);
                  setDisplayName(user?.displayName || '');
                  setPhone(user?.phone || '');
                  setEmail(user?.email || '');
                }}
                disabled={profileSaving}
              >
                <Text style={[styles.editCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.editSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <DetailRow icon="person-outline" label="Name" value={user?.displayName || 'N/A'} />
            <DetailRow icon="call-outline" label="Phone" value={user?.phone || 'N/A'} />
            <DetailRow icon="mail-outline" label="Email" value={user?.email || 'N/A'} />
            <DetailRow icon="shield-checkmark-outline" label="Role" value={getRoleLabel(user?.role || '')} />
            <DetailRow icon="id-card-outline" label="Vendor ID" value={user?.vendorId || 'N/A'} />
            <TouchableOpacity
              style={[styles.editProfileBtn, { borderColor: colors.primary }]}
              onPress={() => setEditingProfile(true)}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={[styles.editProfileBtnText, { color: colors.primary }]}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </DataCard>

      {/* Change Password Section */}
      <SectionTitle title="Security" />
      <DataCard>
        {changingPassword ? (
          <>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Current Password</Text>
              <TextInput
                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>New Password</Text>
              <TextInput
                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password (min 6 chars)"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: colors.textMuted }]}>Confirm Password</Text>
              <TextInput
                style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editCancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={passwordSaving}
              >
                <Text style={[styles.editCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, { backgroundColor: colors.danger }]}
                onPress={handleChangePassword}
                disabled={passwordSaving}
              >
                {passwordSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.editSaveText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <DetailRow icon="lock-closed-outline" label="Password" value="••••••••" />
            <TouchableOpacity
              style={[styles.editProfileBtn, { borderColor: colors.danger }]}
              onPress={() => setChangingPassword(true)}
            >
              <Ionicons name="key-outline" size={16} color={colors.danger} />
              <Text style={[styles.editProfileBtnText, { color: colors.danger }]}>Change Password</Text>
            </TouchableOpacity>
          </>
        )}
      </DataCard>

      <View style={{ height: Spacing['4xl'] }} />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  editField: { marginBottom: Spacing.md },
  editLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  editInput: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  editCancelBtn: {
    flex: 1, height: 44, borderRadius: Radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  editCancelText: { fontSize: 14, fontWeight: '600' },
  editSaveBtn: {
    flex: 1, height: 44, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  editSaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.md,
    borderWidth: 1, marginTop: Spacing.md,
  },
  editProfileBtnText: { fontSize: 14, fontWeight: '700' },
});
