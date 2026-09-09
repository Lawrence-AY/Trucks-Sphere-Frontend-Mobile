/**
 * Users Management Screen
 *
 * Features:
 *   - List all users with search
 *   - Add User modal with role assignment (including fuel_operator)
 *   - Edit User modal (tap a user to edit)
 *   - Toggle user active/inactive (long press)
 *   - Back button (top‑left)
 *   - Floating Action Button for adding users
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from '../../utils/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { fetchUsers } from '../../services/api';
import api from '../../services/api';
import { showAlert } from '../../utils/webAlert';
import { MANAGEMENT_ROLE_OPTIONS } from '../../utils/access';
import { getStrongPasswordError, PASSWORD_REQUIREMENTS } from '../../utils/passwordPolicy';

const ROLE_OPTIONS = [
  ...MANAGEMENT_ROLE_OPTIONS,
  { id: 'operator_quarry', name: 'Operator Quarry' },
  { id: 'operator_site', name: 'Operator Site' },
  { id: 'operator_fuel', name: 'Fuel Operator' },
  { id: 'operator_warehouse', name: 'Warehouse Personnel' },
  { id: 'inspector', name: 'Material Inspector' },
];

const QUARRY_LOCATION_OPTIONS = [
  'Hindi',
  'Ngomeni',
  'Jaribuni',
  'Mjanaheri Malindi',
  'Kilifi',
  'Malindi',
  'Local Borrow pit',
  'Witu',
  'Baragoni',
].map((name) => ({ id: name, name }));

export default function UsersScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Add User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    username: '',
    password: '',
    role: 'admin',
    phone: '',
    quarryLocation: '',
  });
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Edit User Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    username: '',
    email: '',
    role: 'admin',
    phone: '',
    newPassword: '',
    quarryLocation: '',
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers({ search });
      setUsers(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function onRefresh() {
    setRefreshing(true);
    loadUsers();
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  }

  function updateEditForm(field: string, value: string) {
    if (field === 'username') return;
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'displayName' && { username: generateUsernameFromDisplay(value) }),
    }));
    if (editFormErrors[field] || (field === 'displayName' && editFormErrors.username)) {
      setEditFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        if (field === 'displayName') delete copy.username;
        return copy;
      });
    }
  }

  function generateUsernameFromDisplay(displayName: string): string {
    if (!displayName) return '';
    const parts = displayName.trim().split(/\s+/);
    const first = parts[0].replace(/[^a-zA-Z]/g, '').toLowerCase();
    const last = parts.length > 1 ? parts[1].replace(/[^a-zA-Z]/g, '').toLowerCase() : '';
    const lastPart = last.slice(0, 3);
    return `${first}${lastPart}`;
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!form.displayName.trim()) errors.displayName = 'Full name is required';
    if (!form.password) errors.password = 'Password is required';
    else {
      const passwordError = getStrongPasswordError(form.password);
      if (passwordError) errors.password = passwordError;
    }
    if (!form.phone.trim()) errors.phone = 'Phone number is required';
    if (!form.role) errors.role = 'Role is required';
    if (form.role === 'operator_quarry' && !form.quarryLocation) errors.quarryLocation = 'Quarry station is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateEditForm(): boolean {
    const errors: Record<string, string> = {};
    if (!editForm.displayName.trim()) errors.displayName = 'Name is required';
    if (!editForm.username.trim()) errors.username = 'Username is required';
    else if (!/^[a-zA-Z0-9_]+$/.test(editForm.username)) errors.username = 'Letters, numbers & underscores only';
    if (!editForm.role) errors.role = 'Role is required';
    if (editForm.role === 'operator_quarry' && !editForm.quarryLocation) errors.quarryLocation = 'Quarry station is required';
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAddUser() {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const nameParts = form.displayName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const result = await api.post('/api/auth/register', {
        displayName: form.displayName.trim(),
        firstName,
        lastName,
        password: form.password,
        role: form.role,
        phone: form.phone.trim(),
        quarryLocation: form.role === 'operator_quarry' ? form.quarryLocation : '',
      });

      const uname = result?.data?.user?.generatedUsername || generateUsernameFromDisplay(form.displayName);
      setForm({ displayName: '', username: '', password: '', role: 'admin', phone: '', quarryLocation: '' });
      setGeneratedUsername('');
      setFormErrors({});
      setShowAddModal(false);
      loadUsers();
      Alert.alert('Success', `User "${uname}" created under role: ${form.role}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to create user';
      showAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  function handleEditClick(user: any) {
    setEditingUser(user);
    setEditForm({
      displayName: user.displayName || user.name || '',
      username: user.username || user.generatedUsername || generateUsernameFromDisplay(user.displayName || user.name || ''),
      email: user.email || '',
      role: user.role || 'admin',
      phone: user.phone || '',
      newPassword: '',
      quarryLocation: user.quarryLocation || '',
    });
    setEditFormErrors({});
    setShowEditModal(true);
  }

  async function handleUpdateUser() {
    if (!validateEditForm()) return;
    setEditSaving(true);
    try {
      const uid = editingUser.uid || editingUser.id;
      await api.put(`/api/users/${uid}`, {
        displayName: editForm.displayName.trim(),
        name: editForm.displayName.trim(),
        username: editForm.username.trim(),
        generatedUsername: editForm.username.trim(),
        role: editForm.role,
        phone: editForm.phone.trim(),
        quarryLocation: editForm.role === 'operator_quarry' ? editForm.quarryLocation : '',
      });
      showAlert('Success', 'User updated successfully');
      setShowEditModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update user';
      showAlert('Error', msg);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!editingUser) return;
    if (!editForm.newPassword) {
      setEditFormErrors((prev) => ({ ...prev, newPassword: 'New password is required' }));
      return;
    }
    const passwordError = getStrongPasswordError(editForm.newPassword);
    if (passwordError) {
      setEditFormErrors((prev) => ({ ...prev, newPassword: passwordError }));
      return;
    }
    setEditSaving(true);
    try {
      await api.put(`/api/users/${editingUser.uid || editingUser.id}/password`, { password: editForm.newPassword });
      setEditForm((prev) => ({ ...prev, newPassword: '' }));
      showAlert('Success', 'Password reset successfully');
    } catch (err: any) {
      showAlert('Error', err?.response?.data?.error || err?.message || 'Failed to reset password');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleStatus(user: any) {
    const newStatus = user.isActive === false ? true : false;
    const action = newStatus ? 'activate' : 'deactivate';
    Alert.alert(
      `${newStatus ? 'Activate' : 'Deactivate'} User`,
      `Are you sure you want to ${action} ${user.displayName || user.name || user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Activate' : 'Deactivate',
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await api.put(`/api/users/${user.uid || user.id}`, { isActive: newStatus });
              showAlert('Updated', `User ${action}d successfully`);
              loadUsers();
            } catch (err: any) {
              showAlert('Error', err?.message || 'Failed to update user');
            }
          },
        },
      ]
    );
  }

  async function handleDeleteUser(user: any, onDeleted?: () => void) {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${user.displayName || user.name || user.email}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/users/${user.uid || user.id}`);
              showAlert('Deleted', 'User deleted successfully');
              loadUsers();
              if (onDeleted) onDeleted();
            } catch (err: any) {
              const msg = err?.response?.data?.error || err?.message || 'Failed to delete user';
              showAlert('Error', msg);
            }
          },
        },
      ]
    );
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.displayName || u.name || '').toLowerCase().includes(q) ||
      (u.username || u.generatedUsername || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  function getRoleBadge(role: string) {
    const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; label: string }> = {
      superadmin: { variant: 'danger', label: 'Super Admin' },
      super_admin: { variant: 'danger', label: 'Super Admin' },
      admin: { variant: 'purple', label: 'Admin' },
      management: { variant: 'purple', label: 'Admin' },
      management_edit: { variant: 'purple', label: 'Admin' },
      adminlite: { variant: 'default', label: 'Admin Lite' },
      management_lite: { variant: 'default', label: 'Admin Lite' },
      vendor: { variant: 'info', label: 'Vendor' },
      operator_quarry: { variant: 'info', label: 'Quarry Op' },
      operator_site: { variant: 'warning', label: 'Site Op' },
      operator_fuel: { variant: 'success', label: 'Fuel Op' },
      operator_warehouse: { variant: 'purple', label: 'Warehouse' },
      inspector: { variant: 'success', label: 'Inspector' },
    };
    const c = config[role] || { variant: 'default' as any, label: role };
    return <Badge label={c.label} variant={c.variant} size="sm" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
   

      {/* ---------- User List ---------- */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]} // extra space for FAB
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <LoadingSkeleton lines={6} variant="card" />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No users found"
            subtitle={search ? 'Try a different search' : 'Tap + to add a user'}
          />
        ) : (
          <View style={styles.list}>
            {filteredUsers.map((user: any) => (
              <View
                key={user.uid || user.id}
                style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.userCardLeft}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.avatarText, { color: colors.primaryText }]}>
                      {(user.displayName || user.name || user.email || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.userNameRow}>
                      {getRoleBadge(user.role)}
                      <Text style={[styles.userName, { color: colors.text }]}>
                        {user.displayName || user.name || 'Unknown'}
                      </Text>
                      {(user.username || user.generatedUsername) ? (
                        <Text style={[styles.userUsername, { color: colors.primaryText }]}>
                          @{user.username || user.generatedUsername}
                        </Text>
                      ) : null}
                      {user.isActive === false && (
                        <Badge label="Inactive" variant="danger" size="sm" />
                      )}
                    </View>
                    <Text style={[styles.userEmail, { color: colors.textMuted }]}>
                      {user.email || ''}
                    </Text>
                    <View style={styles.userMeta}>
                      {user.phone ? (
                        <Text style={[styles.userPhone, { color: colors.textMuted }]}>
                          {user.phone}
                        </Text>
                      ) : null}
                      {user.role === 'operator_quarry' && user.quarryLocation ? (
                        <Text style={[styles.userPhone, { color: colors.textMuted }]}>Stationed: {user.quarryLocation}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                    onPress={() => handleEditClick(user)}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: user.isActive !== false ? '#FEF2F2' : '#ECFDF5',
                      },
                    ]}
                    onPress={() => handleToggleStatus(user)}
                  >
                    <Ionicons
                      name={user.isActive !== false ? 'close-circle-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={user.isActive !== false ? '#EF4444' : '#10B981'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]}
                    onPress={() => handleDeleteUser(user)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ---------- FAB ---------- */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: insets.bottom + 24,
          },
        ]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ---------- Add User Modal ---------- */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add User</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={[styles.modalBody, { paddingBottom: 80 }]} // extra space for keyboard
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Input
                label="Full Name"
                value={form.displayName}
                onChangeText={(v) => updateForm('displayName', v)}
                placeholder="Enter full name"
                icon="person-outline"
                required
                error={formErrors.displayName}
              />
              <Input
                label="Username"
                value={
                  generatedUsername ||
                  generateUsernameFromDisplay(form.displayName)
                }
                onChangeText={(v) => setGeneratedUsername(v)}
                placeholder="Auto-generated from name"
                icon="person-outline"
                editable={false}
              />
              <Input
                label="Password"
                value={form.password}
                onChangeText={(v) => updateForm('password', v)}
                placeholder="Enter a strong password"
                icon="lock-closed-outline"
                secureTextEntry
                required
                error={formErrors.password}
              />
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{PASSWORD_REQUIREMENTS}</Text>
              <Input
                label="Phone"
                value={form.phone}
                onChangeText={(v) => updateForm('phone', v)}
                placeholder="+254 7XX XXX XXX"
                icon="call-outline"
                keyboardType="phone-pad"
                required
                error={formErrors.phone}
              />
              <Select
                label="Role"
                value={form.role}
                options={ROLE_OPTIONS}
                onSelect={(v) => updateForm('role', v)}
                icon="shield-outline"
                required
                error={formErrors.role}
                nativeModal
              />
              {form.role === 'operator_quarry' && (
                <Select
                  label="Stationed at"
                  value={form.quarryLocation}
                  options={QUARRY_LOCATION_OPTIONS}
                  onSelect={(v) => updateForm('quarryLocation', v)}
                  icon="location-outline"
                  required
                  error={formErrors.quarryLocation}
                  placeholder="Choose quarry location..."
                  nativeModal
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <View style={styles.modalActionRow}>
                <Button
                  title="Cancel"
                  onPress={() => setShowAddModal(false)}
                  variant="secondary"
                  style={styles.modalActionButton}
                />
                <Button
                  title="Create User"
                  onPress={handleAddUser}
                  style={styles.modalActionButton}
                  loading={saving}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- Edit User Modal ---------- */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit User</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingUser(null); }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={[styles.modalBody, { paddingBottom: 80 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Input
                label="Full Name"
                value={editForm.displayName}
                onChangeText={(v) => updateEditForm('displayName', v)}
                placeholder="Enter full name"
                icon="person-outline"
                required
                error={editFormErrors.displayName}
              />
              <Input
                label="Username"
                value={editForm.username}
                onChangeText={() => {}}
                editable={false}
                placeholder="Auto-generated from name"
                icon="at-outline"
                required
                error={editFormErrors.username}
              />
              <Input
                label="Phone (optional)"
                value={editForm.phone}
                onChangeText={(v) => updateEditForm('phone', v)}
                placeholder="+254 7XX XXX XXX"
                icon="call-outline"
                keyboardType="phone-pad"
              />
              <Input
                label="New Password"
                value={editForm.newPassword}
                onChangeText={(v) => updateEditForm('newPassword', v)}
                placeholder="Enter a strong new password"
                icon="lock-closed-outline"
                secureTextEntry
                error={editFormErrors.newPassword}
              />
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{PASSWORD_REQUIREMENTS}</Text>
              <Select
                label="Role"
                value={editForm.role}
                options={ROLE_OPTIONS}
                onSelect={(v) => updateEditForm('role', v)}
                icon="shield-outline"
                required
                error={editFormErrors.role}
                nativeModal
              />
              {editForm.role === 'operator_quarry' && (
                <Select
                  label="Stationed at"
                  value={editForm.quarryLocation}
                  options={QUARRY_LOCATION_OPTIONS}
                  onSelect={(v) => updateEditForm('quarryLocation', v)}
                  icon="location-outline"
                  required
                  error={editFormErrors.quarryLocation}
                  placeholder="Choose quarry location..."
                  nativeModal
                />
              )}
              <Text style={[styles.editHint, { color: colors.textMuted }]}>
                Use the action buttons on the user card to activate, deactivate, or delete users.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <View style={styles.modalActionRow}>
                <Button
                  title="Cancel"
                  onPress={() => { setShowEditModal(false); setEditingUser(null); }}
                  variant="secondary"
                  style={styles.modalActionButton}
                />
                <Button
                  title="Save Changes"
                  onPress={handleUpdateUser}
                  style={styles.modalActionButton}
                  loading={editSaving}
                />
              </View>
              <View style={styles.modalActionRow}>
                <Button
                  title="Reset Password"
                  onPress={handleResetPassword}
                  variant="secondary"
                  style={styles.modalActionButton}
                  loading={editSaving}
                />
                <Button
                  title="Delete User"
                  onPress={() => {
                    handleDeleteUser(editingUser, () => {
                      setShowEditModal(false);
                      setEditingUser(null);
                    });
                  }}
                  variant="danger"
                  style={styles.modalActionButton}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ---------- Header ----------
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginLeft: 4,
  },
  
  // ---------- FAB ----------
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  list: {
    gap:0.1,
  },
  userCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  userCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userId: {
    fontSize: 10,
    marginTop: Spacing.xs,
  },
  userEmail: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  userUsername: {
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  userPhone: {
    fontSize: 11,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  // ---------- Modal ----------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalActions: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalActionButton: {
    flex: 1,
  },
});