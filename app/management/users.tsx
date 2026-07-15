/**
 * Users Management Screen
 *
 * Features:
 *   - List all users with search
 *   - Add User modal with role assignment (including fuel_operator)
 *   - Toggle user active/inactive
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
  Alert,
  RefreshControl,
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

const ROLE_OPTIONS = [
  { id: 'management', name: 'Management' },
  { id: 'vendor', name: 'Vendor' },
  { id: 'quarry_operator', name: 'Quarry Operator' },
  { id: 'site_operator', name: 'Site Operator' },
  { id: 'fuel_operator', name: 'Fuel Operator' },
  { id: 'weighbridge_operator', name: 'Weighbridge Operator' },
  { id: 'driver', name: 'Driver' },
  { id: 'viewer', name: 'Viewer' },
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
    email: '',
    displayName: '',
    password: '',
    role: 'viewer',
    phone: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Invalid email';
    if (!form.displayName.trim()) errors.displayName = 'Name is required';
    if (!form.password || form.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (!form.role) errors.role = 'Role is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAddUser() {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await api.post('/api/auth/register', {
        email: form.email.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim(),
      });
      Alert.alert('Success', 'User created successfully');
      setShowAddModal(false);
      setForm({ email: '', displayName: '', password: '', role: 'viewer', phone: '' });
      loadUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to create user';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: any) {
    const newStatus = user.isActive === false ? true : false;
    try {
      await api.put(`/api/users/${user.uid || user.id}`, { isActive: newStatus });
      Alert.alert('Updated', `User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      loadUsers();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update user');
    }
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.displayName || u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  function getRoleBadge(role: string) {
    const config: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'; label: string }> = {
      management: { variant: 'purple', label: 'Management' },
      vendor: { variant: 'info', label: 'Vendor' },
      quarry_operator: { variant: 'info', label: 'Quarry Op' },
      site_operator: { variant: 'warning', label: 'Site Op' },
      fuel_operator: { variant: 'success', label: 'Fuel Op' },
      weighbridge_operator: { variant: 'default', label: 'Weighbridge Op' },
      driver: { variant: 'default', label: 'Driver' },
      viewer: { variant: 'default', label: 'Viewer' },
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
              <TouchableOpacity
                key={user.uid || user.id}
                style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onLongPress={() => handleToggleStatus(user)}
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
                <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
              </TouchableOpacity>
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
                label="Email"
                value={form.email}
                onChangeText={(v) => updateForm('email', v)}
                placeholder="john@example.com"
                icon="mail-outline"
                keyboardType="email-address"
                required
                error={formErrors.email}
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
                label="Phone (optional)"
                value={form.phone}
                onChangeText={(v) => updateForm('phone', v)}
                placeholder="+254 7XX XXX XXX"
                icon="call-outline"
                keyboardType="phone-pad"
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
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
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
  userPhone: {
    fontSize: 11,
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
