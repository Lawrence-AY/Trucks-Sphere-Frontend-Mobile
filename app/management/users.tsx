/**
 * Users Management Screen
 *
 * Features:
 *   - List all users with search
 *   - Add User modal with role assignment (including fuel_operator)
 *   - Edit User modal (tap a user to edit)
 *   - Toggle user active/inactive (long press)
 *   - Back button
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { fetchUsers, fetchRoles } from '../../services/api';
import api from '../../services/api';
import { showAlert } from '../../utils/webAlert';

const ROLE_OPTIONS = [
  { id: 'management', name: 'Management' },
  { id: 'operator_quarry', name: 'Operator at Quarry' },
  { id: 'operator_site', name: 'Operator at Site' },
  { id: 'vendor', name: 'Vendor' },
  { id: 'operator_fuel', name: 'Fuel Attendant' },
];

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
    role: 'vendor',
    phone: '',
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
    role: 'vendor',
    phone: '',
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
    setEditForm((prev) => ({ ...prev, [field]: value }));
    if (editFormErrors[field]) {
      setEditFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
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
    if (!form.password || form.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (!form.phone.trim()) errors.phone = 'Phone number is required';
    if (!form.role) errors.role = 'Role is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateEditForm(): boolean {
    const errors: Record<string, string> = {};
    if (!editForm.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(editForm.email)) errors.email = 'Invalid email';
    if (!editForm.displayName.trim()) errors.displayName = 'Name is required';
    if (!editForm.username.trim()) errors.username = 'Username is required';
    else if (!/^[a-zA-Z0-9_]+$/.test(editForm.username)) errors.username = 'Letters, numbers & underscores only';
    if (!editForm.role) errors.role = 'Role is required';
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
      });

      const uname = result?.data?.user?.generatedUsername || generateUsernameFromDisplay(form.displayName);
      Alert.alert('Success', `User "${uname}" created under role: ${form.role}`);
      setForm({ displayName: '', username: '', password: '', role: 'vendor', phone: '' });
      setGeneratedUsername('');
      setFormErrors({});
      loadUsers();
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
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'vendor',
      phone: user.phone || '',
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
        email: editForm.email.trim(),
        role: editForm.role,
        phone: editForm.phone.trim(),
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

  async function handleDeleteUser(user: any) {
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
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  function getRoleBadge(role: string) {
    const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; label: string }> = {
      management: { variant: 'purple', label: 'Management' },
      vendor: { variant: 'info', label: 'Vendor' },
      operator_quarry: { variant: 'info', label: 'Quarry Op' },
      operator_site: { variant: 'warning', label: 'Site Op' },
      operator_fuel: { variant: 'success', label: 'Fuel Op' },
    };
    const c = config[role] || { variant: 'default' as any, label: role };
    return <Badge label={c.label} variant={c.variant} size="sm" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Users</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Search */}
        <Input
          label="Search"
          placeholder="Search users..."
          value={search}
          onChangeText={setSearch}
          icon="search-outline"
        />

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
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {(user.displayName || user.name || user.email || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.userNameRow}>
                      <Text style={[styles.userName, { color: colors.text }]}>
                        {user.displayName || user.name || 'Unknown'}
                      </Text>
                      {user.username ? (
                        <Text style={[styles.userUsername, { color: colors.primary }]}>
                          @{user.username}
                        </Text>
                      ) : null}
                      {user.isActive === false && (
                        <Badge label="Inactive" variant="danger" size="sm" />
                      )}
                    </View>
                    <Text style={[styles.userEmail, { color: colors.textMuted }]}>
                      {user.email || 'No email'}
                    </Text>
                    <View style={styles.userMeta}>
                      {getRoleBadge(user.role)}
                      {user.phone ? (
                        <Text style={[styles.userPhone, { color: colors.textMuted }]}>
                          {user.phone}
                        </Text>
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
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
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

      {/* Add User Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add User</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Input
                label="Full Name"
                value={form.displayName}
                onChangeText={(v) => updateForm('displayName', v)}
                placeholder="John Doe"
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
                placeholder="Min 6 characters"
                icon="lock-closed-outline"
                secureTextEntry
                required
                error={formErrors.password}
              />
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
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowAddModal(false)}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <Button
                title="Create User"
                onPress={handleAddUser}
                icon="person-add-outline"
                style={{ flex: 1 }}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit User</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingUser(null); }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Input
                label="Full Name"
                value={editForm.displayName}
                onChangeText={(v) => updateEditForm('displayName', v)}
                placeholder="John Doe"
                icon="person-outline"
                required
                error={editFormErrors.displayName}
              />
              <Input
                label="Username"
                value={editForm.username}
                onChangeText={(v) => updateEditForm('username', v)}
                placeholder="johndoe"
                icon="at-outline"
                required
                error={editFormErrors.username}
              />
              <Input
                label="Email"
                value={editForm.email}
                onChangeText={(v) => updateEditForm('email', v)}
                placeholder="john@example.com"
                icon="mail-outline"
                keyboardType="email-address"
                required
                error={editFormErrors.email}
              />
              <Input
                label="Phone (optional)"
                value={editForm.phone}
                onChangeText={(v) => updateEditForm('phone', v)}
                placeholder="+254 7XX XXX XXX"
                icon="call-outline"
                keyboardType="phone-pad"
              />
              <Select
                label="Role"
                value={editForm.role}
                options={ROLE_OPTIONS}
                onSelect={(v) => updateEditForm('role', v)}
                icon="shield-outline"
                required
                error={editFormErrors.role}
              />
              <Text style={[styles.editHint, { color: colors.textMuted }]}>
                Use the action buttons on the user card to activate, deactivate, or delete users.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => { setShowEditModal(false); setEditingUser(null); }}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <Button
                title="Update User"
                onPress={handleUpdateUser}
                icon="save-outline"
                style={{ flex: 1 }}
                loading={editSaving}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 4,
    flex: 1,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.md,
  },
  list: {
    gap: Spacing.sm,
  },
  userCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
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
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userId: {
    fontSize: 10,
    marginTop: 1,
  },
  userEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
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
  // Modal
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
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
});