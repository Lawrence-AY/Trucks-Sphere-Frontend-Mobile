import { useCallback, useRef, useState } from 'react';

import { Tabs, useRouter } from 'expo-router';
import {
  Platform, StyleSheet, View, Text, Animated, useWindowDimensions,
  TouchableOpacity, ScrollView, Pressable, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { getRoleLabel } from '../../utils/helpers';
import type { UserRole } from '../../store/types';

type TabName = string;

// All users see these 5 bottom tabs
const BOTTOM_TABS: TabName[] = ['dashboard', 'active', 'materials', 'drivers', 'orders'];
const HIDDEN_TABS: TabName[] = ['search', 'history', 'profile', 'trucks'];

const TAB_ICONS: Record<string, { icon: any; label: string; family: string }> = {
  dashboard: { icon: 'dashboard', label: 'Dashboard', family: 'MaterialIcons' },
  active: { icon: 'activity', label: 'Active', family: 'Feather' },
  materials: { icon: 'cube', label: 'Materials', family: 'Ionicons' },
  drivers: { icon: 'people', label: 'Drivers', family: 'Ionicons' },
  search: { icon: 'search', label: 'Search', family: 'Ionicons' },
  history: { icon: 'time', label: 'History', family: 'Ionicons' },
  profile: { icon: 'person', label: 'Profile', family: 'Ionicons' },
  trucks: { icon: 'car', label: 'Trucks', family: 'Ionicons' },
  orders: { icon: 'document-text', label: 'Orders', family: 'Ionicons' },
};

const getTabIcon = (name: string, focused: boolean, color: string) => {
  const config = TAB_ICONS[name];
  if (!config) return <Ionicons name="ellipse" size={24} color={color} />;
  const size = 24;
  switch (config.family) {
    case 'MaterialIcons':
      return <MaterialIcons name={config.icon as any} size={size} color={color} />;
    case 'Feather':
      return <Feather name={config.icon as any} size={size} color={color} />;
    default:
      return <Ionicons name={config.icon as any} size={size} color={color} />;
  }
};

const HAMBURGER_ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string; roles: UserRole[] }[] = [
  { label: 'Settings', icon: 'settings-outline', route: '/management/settings', roles: ['admin', 'management'] },
  { label: 'Settings', icon: 'settings-outline', route: '/vendor/settings', roles: ['vendor'] },
  { label: 'Settings', icon: 'settings-outline', route: '/operator-site/settings', roles: ['operator_site'] },
  { label: 'Settings', icon: 'settings-outline', route: '/operator-quarry/settings', roles: ['operator_quarry'] },
  { label: 'Settings', icon: 'settings-outline', route: '/operator-fuel/settings', roles: ['operator_fuel'] },
  { label: 'Issues', icon: 'chatbubble-ellipses-outline', route: '/screens/issues', roles: ['admin', 'management', 'operator_quarry', 'operator_site', 'vendor'] },
  { label: 'History', icon: 'time-outline', route: '/(tabs)/history', roles: ['admin', 'management', 'operator_quarry', 'operator_site'] },
  { label: 'Weigh-In', icon: 'download-outline', route: '/quarry/weigh-in', roles: ['operator_quarry'] },
  { label: 'Weigh-Out', icon: 'arrow-up-circle-outline', route: '/quarry/weigh-out', roles: ['operator_quarry'] },
  { label: 'Receive', icon: 'checkmark-circle-outline', route: '/site/receive', roles: ['operator_site'] },
  { label: 'Export Data', icon: 'cloud-download-outline', route: '/screens/issues', roles: ['admin', 'management'] },
  { label: 'Vendors', icon: 'business-outline', route: '/screens/vendor-details', roles: ['admin', 'management'] },
  { label: 'Fuel', icon: 'water-outline', route: '/screens/fuel', roles: ['admin', 'management', 'vendor'] },
];

export default function TabsLayout() {
  const { user, logout } = useAuthStore();
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutSuccess, setLogoutSuccess] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const menuWidth = Math.min(screenWidth * 0.86, 360);

  const role = (user?.role || '') as UserRole;

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: menuWidth, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMenuOpen(false));
    } else {
      setMenuOpen(true);
      slideAnim.setValue(menuWidth);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [menuOpen, slideAnim, fadeAnim, menuWidth]);

  const handleNav = (route: string) => {
    toggleMenu();
    setTimeout(() => {
      // @ts-ignore
      router.push(route);
    }, 300);
  };

  const requestLogout = () => {
    setConfirmLogout(true);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setConfirmLogout(false);
    setLogoutSuccess(true);
    setMenuOpen(false);
    setTimeout(() => {
      setLogoutSuccess(false);
      router.replace('/(auth)/login');
    }, 900);
  };

  const filteredMenu = HAMBURGER_ITEMS.filter(
    (item) => item.roles.includes(role)
  );

  return (
      <View style={{ flex: 1 }}>
      <Tabs
        tabBar={Platform.OS === 'web' ? () => null : undefined}
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: Platform.OS !== 'web',
          headerShown: Platform.OS !== 'web',
          tabBarLabelStyle: Platform.OS === 'web' ? { display: 'none' } : styles.tabBarLabel,
          tabBarStyle: Platform.OS === 'web'
            ? { display: 'none', height: 0, overflow: 'hidden', position: 'absolute', opacity: 0, pointerEvents: 'none' }
            : [
            styles.tabBar,
            {
              backgroundColor: '#FFFFFF',
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom + 4 : 6,
              height: Platform.OS === 'ios' ? 72 + insets.bottom : 72,
            },
          ],
        headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          headerRight: Platform.OS === 'web' ? undefined : () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => router.push('/screens/notifications' as any)} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
                <Ionicons name="notifications-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleMenu} style={styles.headerBtn}>
                <View style={[styles.headerMenuIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="menu-outline" size={24} color={colors.primary} />
                </View>
              </TouchableOpacity>
            </View>
          ),
          headerLeft: Platform.OS === 'ios'
            ? () => <View style={{ width: 8 }} />
            : undefined,
        }}
      >
        {BOTTOM_TABS.map((tabName) => {
          const config = TAB_ICONS[tabName];
          return (
            <Tabs.Screen
              key={tabName}
              name={tabName}
              options={{
                title: config?.label || tabName,
                tabBarLabel: config?.label || tabName,
                tabBarIcon: ({ color, focused }) => (
                  <View style={[
                    styles.tabIconWrap,
                    focused && { backgroundColor: colors.primary + '12' },
                  ]}>
                    {getTabIcon(tabName, focused, focused ? colors.primary : colors.textSecondary)}
                  </View>
                ),
              }}
            />
          );
        })}
        {Platform.OS !== 'web' && HIDDEN_TABS.map((tabName) => (
          <Tabs.Screen
            key={tabName}
            name={tabName}
            options={{ href: null }}
          />
        ))}
      </Tabs>

      {/* Hamburger Menu Modal */}
      {menuOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleMenu} />
          </Animated.View>
          <Animated.View
            style={[
              styles.menuPanel,
              {
                width: menuWidth,
                backgroundColor: '#0B1726',
                transform: [{ translateX: slideAnim }],
                paddingTop: insets.top + Spacing.lg,
              },
            ]}
          >
            {/* User Section */}
            <View style={styles.menuUser}>
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>
                  {(user?.displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.menuUserName} numberOfLines={1}>
                {user?.displayName || 'User'}
              </Text>
              <Text style={styles.menuUserEmail} numberOfLines={1}>
                {user?.email || ''}
              </Text>
              <View style={styles.menuRoleBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#3ED9D6" />
                <Text style={styles.menuRoleText}>
                  {getRoleLabel(role)}
                </Text>
              </View>
            </View>

            {/* Menu Items - centered vertically */}
            <ScrollView style={styles.menuItems} contentContainerStyle={styles.menuItemsContent}>
              {filteredMenu.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={styles.menuItem}
                  onPress={() => handleNav(item.route)}
                >
                  <Ionicons name={item.icon} size={22} color="#D5E2F0" />
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Logout */}
            <View style={styles.menuLogout}>
              <TouchableOpacity style={styles.menuLogoutBtn} onPress={requestLogout}>
                <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
                <Text style={styles.menuLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.logoutDialog}>
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={34} color="#FF6B6B" />
            </View>
            <Text style={styles.logoutTitle}>Logout</Text>
            <Text style={styles.logoutMessage}>Are you sure you want to logout?</Text>
            <View style={styles.logoutActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmLogout(false)}
                disabled={loggingOut}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, loggingOut && styles.confirmBtnDisabled]}
                onPress={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmText}>Logout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {logoutSuccess ? (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
          <Text style={styles.successToastText}>Logged out successfully</Text>
        </View>
      ) : null}
      </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    paddingTop: 7,
    paddingHorizontal: 4,
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0,
  },
  tabIconWrap: {
    width: 42,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    padding: Spacing.sm,
    paddingRight: Spacing.md,
  },
  headerMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Menu overlay
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 999,
  },
  menuPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuUser: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(151, 184, 212, 0.14)',
  },
  menuAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    backgroundColor: '#147DFF',
  },
  menuAvatarText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  menuUserName: { fontSize: 17, fontWeight: '800', marginBottom: 2, color: '#F8FAFC' },
  menuUserEmail: { fontSize: 12, marginBottom: Spacing.md, color: '#91A7BC' },
  menuRoleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: Radius.full,
    backgroundColor: 'rgba(62, 217, 214, 0.12)',
  },
  menuRoleText: { fontSize: 10, fontWeight: '800', letterSpacing: 0, color: '#3ED9D6' },
  menuItems: { flex: 1 },
  menuItemsContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.xl },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(151, 184, 212, 0.09)',
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: { fontSize: 16, fontWeight: '700', color: '#D5E2F0' },
  menuLogout: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    paddingBottom: Spacing['4xl'],
    borderTopColor: 'rgba(151, 184, 212, 0.14)',
  },
  menuLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  menuLogoutText: { fontSize: 16, fontWeight: '800', color: '#FF6B6B' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logoutDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    padding: Spacing.xl,
    backgroundColor: '#132235',
    borderWidth: 1,
    borderColor: 'rgba(151, 184, 212, 0.16)',
    alignItems: 'center',
  },
  logoutIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoutTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  logoutMessage: {
    color: '#AFC1D2',
    fontSize: 14,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  logoutActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: '#24364A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#E6F3FF',
    fontSize: 15,
    fontWeight: '800',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.72,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  successToast: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: 96,
    minHeight: 56,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  successToastText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
});
