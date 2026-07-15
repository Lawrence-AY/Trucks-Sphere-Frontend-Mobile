import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { Spacing, Radius } from '../../constants/theme';
import { getRoleLabel } from '../../utils/helpers';
import { showAlert } from '../../utils/webAlert';

export default function OperatorSiteSettingsScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [pwModal, setPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const handlePasswordUpdate = () => {
    if (!currentPw || !newPw || !confirmPw) { showAlert('Error', 'Please fill all password fields'); return; }
    if (newPw !== confirmPw) { showAlert('Error', 'New passwords do not match'); return; }
    if (newPw.length < 4) { showAlert('Error', 'Password must be at least 4 characters'); return; }
    showAlert('Success', 'Password updated successfully');
    setPwModal(false); setCurrentPw(''); setNewPw(''); setConfirmPw('');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing['4xl'] }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Settings</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ alignItems: 'center', gap: Spacing.md }}>
          <View style={[styles.avatar, { backgroundColor: '#1B2A4A18' }]}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#1B2A4A' }}>{(user?.displayName || 'S').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.displayName || 'Site Operator'}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email || ''}</Text>
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#1B2A4A18' }}>
            <Text style={{ fontSize: 14, color: '#1B2A4A', fontWeight: '600' }}>{getRoleLabel(user?.role || '')}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setPwModal(true)}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Update Password</Text>
      </TouchableOpacity>

      <Modal visible={pwModal} transparent animationType="fade" onRequestClose={() => setPwModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: Spacing.lg }}>Update Password</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Current password" placeholderTextColor={colors.textMuted} value={currentPw} onChangeText={setCurrentPw} secureTextEntry />
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="New password" placeholderTextColor={colors.textMuted} value={newPw} onChangeText={setNewPw} secureTextEntry />
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Confirm new password" placeholderTextColor={colors.textMuted} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry />
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#E2E8F0' }]} onPress={() => setPwModal(false)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#1B2A4A' }]} onPress={handlePasswordUpdate}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md },
  input: { height: 48, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 14, marginBottom: Spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Spacing.xl },
  modalCard: { borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.xs },
  modalBtn: { flex: 1, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});