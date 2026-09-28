import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { Spacing, Radius } from '../../constants/theme';
import { getRoleLabel } from '../../utils/helpers';
import { showAlert } from '../../utils/webAlert';
import { getPasswordChangeError, PASSWORD_REQUIREMENTS } from '../../utils/passwordPolicy';
import { changePassword } from '../../services/api';

export default function OperatorFuelSettingsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [pwModal, setPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [updating, setUpdating] = useState(false);

  const handlePasswordUpdate = async () => {
    const passwordError = getPasswordChangeError(currentPw, newPw, confirmPw);
    if (passwordError) {
      showAlert('Error', passwordError);
      return;
    }
    setUpdating(true);
    try {
      await changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
        confirmPassword: confirmPw,
      });
      showAlert('Success', 'Password updated successfully');
      setPwModal(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to update password');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing['4xl'] }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Settings</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ alignItems: 'center', gap: Spacing.md }}>
          <View style={[styles.avatar, { backgroundColor: '#F59E0B18' }]}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#F59E0B' }}>{(user?.displayName || 'F').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.displayName || 'Fuel Operator'}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email || ''}</Text>
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F59E0B18' }}>
            <Text style={{ fontSize: 14, color: '#F59E0B', fontWeight: '600' }}>{getRoleLabel(user?.role || '')}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setPwModal(true)}>
        <Ionicons name="lock-closed-outline" size={20} color="#F59E0B" />
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#F59E0B' }}>Update Password</Text>
      </TouchableOpacity>

      <Modal visible={pwModal} transparent animationType="fade" onRequestClose={() => setPwModal(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: Spacing.xs}}>Update Password</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Current password" placeholderTextColor={colors.textMuted} value={currentPw} onChangeText={setCurrentPw} secureTextEntry />
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Enter a strong new password" placeholderTextColor={colors.textMuted} value={newPw} onChangeText={setNewPw} secureTextEntry />
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: Spacing.xs}}>{PASSWORD_REQUIREMENTS}</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Confirm new password" placeholderTextColor={colors.textMuted} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry />
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs}}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.inputBg }]} onPress={() => { setPwModal(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }} disabled={updating}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#F59E0B' }]} onPress={handlePasswordUpdate} disabled={updating}>
                {updating ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md },
  input: { height: 48, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 14, marginBottom: Spacing.xs},
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  modalCard: { borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.xs },
  modalBtn: { flex: 1, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
