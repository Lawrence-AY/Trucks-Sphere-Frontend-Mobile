import { useCallback, useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  Platform, StyleSheet, View, Text, Animated, Dimensions,
  TouchableOpacity, ScrollView, Pressable,
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
const BOTTOM_TABS: TabName[] = ['dashboard', 'active', 'vendors', 'drivers', 'search'];

const TAB_ICONS: Record<string, { icon: any; label: string; family: string }> = {
  dashboard: { icon: 'dashboard', label: 'Dashboard', family: 'MaterialIcons' },
  active: { icon: 'activity', label: 'Active', family: 'Feather' },
  vendors: { icon: 'briefcase', label: 'Vendors', family: 'Ionicons' },
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
  { label: 'Dashboard', icon: 'grid-outline', route: '/', roles: ['management', 'operator_quarry', 'operator_site', 'vendor'] },
  { label: 'Weigh-In', icon: 'download-outline', route: '/quarry/weigh-in', roles: ['operator_quarry'] },
  { label: 'Weigh-Out', icon: 'upload-outline', route: '/quarry/weigh-out', roles: ['operator_quarry'] },
  { label: 'Receive', icon: 'checkmark-circle-outline', route: '/site/receive', roles: ['operator_site'] },
  { label: 'History', icon: 'time-outline', route: '/(tabs)/history', roles: ['management', 'operator_quarry', 'operator_site'] },
  { label: 'Profile', icon: 'person-outline', route: '/(tabs)/profile', roles: ['management', 'operator_quarry', 'operator_site', 'vendor'] },
  { label: 'Trucks', icon: 'car-outline', route: '/(tabs)/trucks', roles: ['management'] },
  { label: 'Orders', icon: 'document-text-outline', route: '/(tabs)/orders', roles: ['management', 'vendor'] },
];

export default function TabsLayout() {
  const { user, logout } = useAuthStore();
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const menuWidth = screenWidth * 0.72;

  const role = (user?.role || 'management') as UserRole;

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: screenWidth, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMenuOpen(false));
    } else {
      setMenuOpen(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: screenWidth - menuWidth, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [menuOpen, slideAnim, fadeAnim, screenWidth, menuWidth]);

  const handleNav = (route: string) => {
    toggleMenu();
    setTimeout(() => {
      // @ts-ignore
      router.push(route);
    }, 300);
  };

  const handleLogout = async () => {
    toggleMenu();
    setTimeout(async () => {
      await logout();
      router.replace('/(auth)/login');
    }, 300);
  };

  const filteredMenu = HAMBURGER_ITEMS.filter(
    (item) => item.roles.includes(role)
  );

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: false,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
              height: Platform.OS === 'ios' ? 56 + insets.bottom : 56,
            },
          ],
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={toggleMenu} style={styles.headerBtn}>
              <Ionicons name="menu-outline" size={24} color={colors.text} />
            </TouchableOpacity>
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
                tabBarIcon: ({ color, focused }) => (
                  <View style={[
                    styles.tabIconWrap,
                    focused && { backgroundColor: colors.accent + '15' },
                  ]}>
                    {getTabIcon(tabName, focused, focused ? colors.accent : colors.textSecondary)}
                  </View>
                ),
              }}
            />
          );
        })}
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
                backgroundColor: colors.surface,
                transform: [{ translateX: slideAnim }],
                paddingTop: insets.top + Spacing.lg,
              },
            ]}
          >
            {/* User Section */}
            <View style={[styles.menuUser, { borderBottomColor: colors.border }]}>
              <View style={[styles.menuAvatar, { backgroundColor: colors.accent + '20' }]}>
                <Text style={[styles.menuAvatarText, { color: colors.accent }]}>
                  {(user?.displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.menuUserName, { color: colors.text }]} numberOfLines={1}>
                {user?.displayName || 'User'}
              </Text>
              <Text style={[styles.menuUserEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {user?.email || ''}
              </Text>
              <View style={[styles.menuRoleBadge, { backgroundColor: colors.accent + '15' }]}>
                <Text style={[styles.menuRoleText, { color: colors.accent }]}>
                  {getRoleLabel(role)}
                </Text>
              </View>
            </View>

            {/* Menu Items */}
            <ScrollView style={styles.menuItems}>
              {filteredMenu.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={styles.menuItem}
                  onPress={() => handleNav(item.route)}
                >
                  <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Logout */}
            <View style={[styles.menuLogout, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={styles.menuLogoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                <Text style={[styles.menuLogoutText, { color: colors.danger }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0.5,
    paddingTop: 4,
    paddingHorizontal: 4,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabIconWrap: {
    width: 42,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    padding: Spacing.sm,
    paddingRight: Spacing.md,
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
  },
  menuAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  menuAvatarText: { fontSize: 24, fontWeight: '800' },
  menuUserName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  menuUserEmail: { fontSize: 12, marginBottom: Spacing.md },
  menuRoleBadge: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  menuRoleText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  menuItems: { flex: 1, paddingTop: Spacing.xs },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  menuLogout: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    paddingBottom: Spacing['3xl'],
  },
  menuLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  menuLogoutText: { fontSize: 15, fontWeight: '600' },
});
