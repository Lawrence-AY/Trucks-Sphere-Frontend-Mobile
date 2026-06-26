import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel } from '../../utils/helpers';

export default function ProfileScreen() {
  const colors = useTheme();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  type ProfileItem = { icon: string; label: string; value: string; action?: boolean };

  const profileSections: { title: string; items: ProfileItem[] }[] = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Display Name', value: user?.displayName || '-' },
        { icon: 'mail-outline', label: 'Email', value: user?.email || '-' },
        { icon: 'call-outline', label: 'Phone', value: user?.phone || '-' },
        { icon: 'shield-checkmark-outline', label: 'Role', value: getRoleLabel(user?.role || 'management') },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: 'notifications-outline', label: 'Notifications', value: 'Enabled', action: true },
        { icon: 'moon-outline', label: 'Dark Mode', value: 'System', action: true },
      ],
    },
  ];


  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {(user?.displayName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user?.displayName || 'User'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: colors.primary + '12' }]}>
          <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
          <Text style={[styles.roleText, { color: colors.primary }]}>
            {getRoleLabel(user?.role || 'management')}
          </Text>
        </View>
      </View>

      {/* Sections */}
      {profileSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.profileItem,
                  idx < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                ]}
                activeOpacity={item.action ? 0.6 : 1}
              >
                <View style={[styles.profileIcon, { backgroundColor: colors.primary + '08' }]}>
                  <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.profileValue, { color: colors.textSecondary }]}>{item.value}</Text>
                </View>
                {item.action && (
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* App Info */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>App</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <View style={styles.profileItem}>
            <View style={[styles.profileIcon, { backgroundColor: colors.primary + '08' }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileLabel, { color: colors.text }]}>Version</Text>
              <Text style={[styles.profileValue, { color: colors.textSecondary }]}>1.0.0</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.surface }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: Spacing['4xl'] },
  header: { alignItems: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.sm },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  name: { fontSize: 20, fontWeight: '700' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  roleText: { fontSize: 12, fontWeight: '700' },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  sectionCard: { borderRadius: Radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  profileItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  profileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1 },
  profileLabel: { fontSize: 14, fontWeight: '600' },
  profileValue: { fontSize: 12, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg, borderRadius: Radius.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
});
