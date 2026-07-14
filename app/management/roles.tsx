/**
 * Roles & Permissions Screen - Manage system roles and their permissions
 *
 * Features:
 *   - List all roles with user count
 *   - View role permissions
 *   - Create/edit roles
 *   - Toggle permissions
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: string[];
  isSystem: boolean;
}

const DEFAULT_ROLES: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
    userCount: 2,
    permissions: ['all'],
    isSystem: true,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Can manage operations, procurement, and fleet',
    userCount: 5,
    permissions: ['read', 'create', 'update', 'approve', 'cancel'],
    isSystem: true,
  },
  {
    id: 'dispatcher',
    name: 'Dispatcher',
    description: 'Can create and manage jobs, assign drivers',
    userCount: 8,
    permissions: ['read', 'create', 'update', 'assign'],
    isSystem: true,
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'Can record weighbridge and fuel data',
    userCount: 12,
    permissions: ['read', 'create', 'update'],
    isSystem: true,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to reports and dashboards',
    userCount: 20,
    permissions: ['read'],
    isSystem: true,
  },
];

const PERMISSION_LABELS: Record<string, string> = {
  all: 'Full Access',
  read: 'Read',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  approve: 'Approve',
  cancel: 'Cancel',
  archive: 'Archive',
  assign: 'Assign',
};

export default function RolesScreen() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setRoles(DEFAULT_ROLES);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Roles & Permissions</Text>
        </View>
        <LoadingSkeleton lines={5} variant="card" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <View style={[styles.backBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.backTitle}>Roles & Permissions</Text>
      </View>
      <View style={styles.header}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Manage system roles and their access permissions
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {roles.length === 0 ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title="No roles defined"
            subtitle="Roles will appear here once configured"
          />
        ) : (
          roles.map((role) => {
            const isExpanded = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.roleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setSelectedRole(isExpanded ? null : role.id)}
                activeOpacity={0.7}
              >
                <View style={styles.roleHeader}>
                  <View style={[styles.roleIcon, { backgroundColor: role.isSystem ? colors.primary + '15' : colors.success + '15' }]}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={22}
                      color={role.isSystem ? colors.primary : colors.success}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleName, { color: colors.text }]}>{role.name}</Text>
                    <Text style={[styles.roleDesc, { color: colors.textMuted }]}>{role.description}</Text>
                  </View>
                  <View style={styles.roleMeta}>
                    <Badge label={`${role.userCount} users`} variant="info" size="sm" />
                    {role.isSystem && (
                      <Badge label="System" variant="default" size="sm" />
                    )}
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>

                {isExpanded && (
                  <View style={[styles.permissionsSection, { borderTopColor: colors.border }]}>
                    <Text style={[styles.permissionsTitle, { color: colors.text }]}>Permissions:</Text>
                    <View style={styles.permissionsGrid}>
                      {role.permissions.map((perm) => (
                        <View key={perm} style={[styles.permissionChip, { backgroundColor: colors.primary + '10' }]}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                          <Text style={[styles.permissionText, { color: colors.primary }]}>
                            {PERMISSION_LABELS[perm] || perm}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 2 },
  list: { padding: Spacing.md, paddingBottom: Spacing['4xl'] },
  roleCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleName: {
    fontSize: 16,
    fontWeight: '700',
  },
  roleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  roleMeta: {
    gap: 4,
    alignItems: 'flex-end',
  },
  permissionsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  permissionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  permissionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  permissionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  permissionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
