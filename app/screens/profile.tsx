import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { getRoleLabel } from '../../utils/helpers';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const colors = useTheme();
  const role = user?.role || 'management';

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent + '15' }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>
            {(user?.displayName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
        </Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email || 'user@trucksphere.com'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: colors.accent + '15' }]}>
          <Text style={[styles.roleText, { color: colors.accent }]}>
            {getRoleLabel(role).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]}>
          <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>Account Details</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.menuLabel, { color: colors.text }]}>About TruckSphere</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Direct Logout — no confirmation dialog */}
      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.textMuted }]}>TruckSphere v2.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['4xl'] },
  profileCard: {
    borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing['2xl'], alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: { fontSize: 24, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 13, marginTop: 4 },
  roleBadge: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, marginTop: Spacing.md,
  },
  roleText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  menuCard: {
    borderRadius: Radius.lg, borderWidth: 1,
    marginBottom: Spacing.lg, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.lg, gap: Spacing.md,
    borderBottomWidth: 1,
  },
  menuLabel: { flex: 1, fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  logoutText: { fontSize: 15, fontWeight: '600' },
  version: { fontSize: 12, textAlign: 'center', marginTop: Spacing.xl },
});
