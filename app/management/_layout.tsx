import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import {
  Platform, StyleSheet, View, Text, TouchableOpacity, Animated, Pressable, useWindowDimensions, ScrollView, Modal, ActivityIndicator,
  type ColorValue,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { Spacing, Radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getRoleLabel } from '../../utils/helpers';
import { canAccessManagementRoute, MANAGEMENT_ROLES, managementHomeRoute, normalizeRole } from '../../utils/access';

const DEFAULT_BOTTOM_TABS = ['dashboard', 'active', 'orders', 'materials'];
const LITE_BOTTOM_TABS = ['dashboard', 'orders', 'profile'];
const BOTTOM_TABS = [...new Set([...DEFAULT_BOTTOM_TABS, ...LITE_BOTTOM_TABS])];
const HIDDEN_TABS = [
  'super-admin',
  'edit',
  'lite',
  'drivers',
  'drivers/[id]',
  'drivers/create',
  'trucks',
  'trips',
  'settings',
  'fuel',
  'dispatch',
  'quarries',
  'sites',
  'fuel-records',
  'reports',
  'analytics',
  'audit-logs',
  'users',
  'roles',
  'master-data',
  'materials/[id]',
  'materials/create',
  'materials/edit/[id]',
  'purchase-orders',
  'purchase-orders/[id]',
  'purchase-orders/create',
  'purchase-orders/edit/[id]',
  'vehicles',
  'vehicles/[id]',
  'vehicles/create',
  'vendors',
  'vendors/[id]',
  'vendors/create',
  'vendors/edit/[id]',
];

const TAB_ICONS: Record<string, { icon: any; label: string; family: string }> = {
  dashboard: { icon: 'grid-outline', label: 'Dashboard', family: 'Ionicons' },
  orders: { icon: 'document-text-outline', label: 'Orders', family: 'Ionicons' },
  active: { icon: 'pulse-outline', label: 'Active', family: 'Ionicons' },
  materials: { icon: 'cube-outline', label: 'Materials', family: 'Ionicons' },
  profile: { icon: 'person-outline', label: 'Profile', family: 'Ionicons' },
};

const getManagementScreenOptions = (colors: any) => ({
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarShowLabel: Platform.OS !== 'web',
  tabBarLabelStyle: Platform.OS === 'web' ? { display: 'none' as const } : { fontSize: 11, fontWeight: '600' as const },
  tabBarStyle: Platform.OS === 'web'
    ? { display: 'none' as const }
    : {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        paddingBottom: 6,
        paddingTop: 6,
        height: 68,
      },
  headerShown: Platform.OS !== 'web',
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 16 },
  headerShadowVisible: false,
});

const getTabIcon = (name: string, color: ColorValue) => {
  const config = TAB_ICONS[name];
  if (!config) return <Ionicons name="ellipse" size={22} color={color} />;
  switch (config.family) {
    case 'MaterialIcons':
      return <MaterialIcons name={config.icon as any} size={22} color={color} />;
    case 'Feather':
      return <Feather name={config.icon as any} size={22} color={color} />;
    default:
      return <Ionicons name={config.icon as any} size={22} color={color} />;
  }
};

const NoopTabBar = () => null;

// Keep each screen's options referentially stable. React Navigation applies
// options with state updates, so recreating tabBarIcon functions during every
// parent render can cause a nested update loop on Android.
const MANAGEMENT_TAB_OPTIONS: Record<string, any> = Object.fromEntries(
  BOTTOM_TABS.map((tabName) => {
    const config = TAB_ICONS[tabName];
    return [tabName, {
      title: config?.label || tabName,
      tabBarLabel: config?.label || tabName,
      tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
        <View style={[styles.tabIcon, focused && { backgroundColor: '#1B2A4A12' }]}>
          {getTabIcon(tabName, color)}
        </View>
      ),
    }];
  }),
);

type DrawerItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
};

type DrawerSection = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: DrawerItem[];
};

const DRAWER_SECTIONS: DrawerSection[] = [
  {
    title: 'Operations',
    icon: 'radio-outline',
    items: [
      { label: 'Dashboard', icon: 'home-outline', route: '/management/dashboard' },
      { label: 'Active Jobs', icon: 'layers-outline', route: '/management/active' },
      { label: 'Completed Trips', icon: 'checkmark-done-outline', route: '/management/trips' },
     ],
  },
  {
    title: 'Procurement',
    icon: 'cube-outline',
    items: [
      { label: 'Orders', icon: 'document-text-outline', route: '/management/orders' },
      { label: 'Materials', icon: 'cube-outline', route: '/management/materials' },
    ],
  },
  {
    title: 'Fleet',
    icon: 'car-outline',
    items: [
      { label: 'Vendors', icon: 'business-outline', route: '/management/vendors' },
      { label: 'Vehicles', icon: 'car-outline', route: '/management/trucks' },
      { label: 'Drivers', icon: 'people-outline', route: '/management/drivers' },
    ],
  },
  {
    title: 'Locations',
    icon: 'location-outline',
    items: [

      { label: 'Fuel Records', icon: 'water-outline', route: '/management/fuel' },
    ],
  },
  {
    title: 'Intelligence',
    icon: 'analytics-outline',
    items: [
      { label: 'Reports', icon: 'bar-chart-outline', route: '/management/reports' },
 
      { label: 'Issues', icon: 'chatbubble-ellipses-outline', route: '/screens/issues' },
    ],
  },
  {
    title: 'Administration',
    icon: 'settings-outline',
    items: [
      { label: 'Users', icon: 'person-add-outline', route: '/management/users' },
      { label: 'Roles', icon: 'shield-checkmark-outline', route: '/management/roles' },
      { label: 'Master Data', icon: 'server-outline', route: '/management/master-data' },
      { label: 'Profile', icon: 'person-outline', route: '/management/profile' },

      { label: 'Logout', icon: 'log-out-outline', route: '__logout__' },
    ],
  },
];

export default function ManagementLayout() {
  const colors = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const menuWidth = Math.min(screenWidth * 0.8, 320);
  const role = normalizeRole(user?.role);
  const visibleBottomTabs = role === MANAGEMENT_ROLES.LITE ? LITE_BOTTOM_TABS : DEFAULT_BOTTOM_TABS;

  // Hiding an item is not sufficient on web, where a saved URL can still be
  // opened directly. Keep every management role inside its allowed routes.
  useEffect(() => {
    if (role && pathname?.startsWith('/management') && !canAccessManagementRoute(role, pathname)) {
      router.replace(managementHomeRoute(role) as any);
    }
  }, [pathname, role, router]);

  const drawerSections = DRAWER_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) => item.route === '/management/dashboard' ? { ...item, route: managementHomeRoute(role) } : item).filter((item) => {
      if (item.route === '__logout__' || item.route === '/management/profile' || item.route === '/(auth)/forgot-password') return true;
      return item.route ? canAccessManagementRoute(role, item.route) : false;
    }),
  })).filter((section) => section.items.length > 0);

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: menuWidth, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => setMenuOpen(false));
    } else {
      setMenuOpen(true);
      slideAnim.setValue(menuWidth);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [menuOpen, slideAnim, fadeAnim, menuWidth]);

  const handleMenuNav = (route?: string) => {
    if (!route) return;
    if (route === '__logout__') {
      setConfirmLogout(true);
      return;
    }
    toggleMenu();
    setTimeout(() => {
      router.push(route as any);
    }, 250);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setConfirmLogout(false);
    setMenuOpen(false);
    router.replace('/(auth)/login' as any);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={Platform.OS === 'web' ? NoopTabBar : undefined}
        screenOptions={getManagementScreenOptions(colors)}
      >
        {BOTTOM_TABS.map((tabName) => {
          const route = `/management/${tabName}`;
          return (
            <Tabs.Screen
              key={tabName}
              name={tabName}
              options={{
                ...MANAGEMENT_TAB_OPTIONS[tabName],
                ...(visibleBottomTabs.includes(tabName) && canAccessManagementRoute(role, route) ? {} : { href: null }),
              }}
            />
          );
        })}
        {HIDDEN_TABS.map((tabName) => {
          const titleOverrides: Record<string, string> = {
            'drivers': 'Drivers',
            'drivers/create': 'Onboard Driver',
            'trucks': 'Vehicles',
            'fuel': 'Fuel Records',
            'fuel-records': 'Fuel Records',
            'quarries': 'Quarries',
            'sites': 'Sites',
            'reports': 'Reports',
            'analytics': 'Analytics',
            'audit-logs': 'Audit Logs',
            'users': 'Users',
            'roles': 'Roles',
            'master-data': 'Master Data',
            'vendors': 'Vendors',
            'purchase-orders': 'Purchase Orders',
            'vehicles': 'Vehicles',
            'materials/[id]': 'Material Details',
            'materials/edit/[id]': 'Edit Material',
          };
          const hideHeader = tabName === 'drivers/[id]' || tabName === 'drivers/create' || tabName === 'materials/[id]' || tabName === 'materials/create' || tabName === 'materials/edit/[id]' || tabName === 'vendors/[id]' || tabName === 'vendors/create' || tabName === 'vendors/edit/[id]' || tabName === 'vehicles/[id]' || tabName === 'vehicles/create' || tabName === 'purchase-orders/[id]' || tabName === 'purchase-orders/create' || tabName === 'purchase-orders/edit/[id]';
          return (
            <Tabs.Screen
              key={tabName}
              name={tabName}
              options={{
                href: null,
                ...(titleOverrides[tabName] ? { title: titleOverrides[tabName] } : {}),
                ...(hideHeader ? { headerShown: false } : {}),
              }}
            />
          );
        })}
      </Tabs>

      {Platform.OS !== 'web' && !menuOpen && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          style={[styles.floatingMenuButton, { top: insets.top + Spacing.sm, backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={toggleMenu}
        >
          <Ionicons name="menu-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Hamburger Drawer */}
      {menuOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleMenu} />
          </Animated.View>
          <Animated.View style={[styles.drawer, { paddingTop: insets.top + 16, backgroundColor: colors.surface, width: menuWidth, transform: [{ translateX: slideAnim }] }]}>
            <View style={[styles.drawerUser, { borderBottomColor: colors.border }]}>
              <View style={[styles.drawerAvatar, { backgroundColor: colors.primaryLight }]}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primary }}>{(user?.displayName || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.displayName || 'User'}</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.email || ''}</Text>
              <View style={{ marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primaryLight }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>{getRoleLabel(user?.role || '')}</Text>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
              {drawerSections.map((section) => (
                <View key={section.title} style={styles.drawerSection}>
                  <View style={styles.drawerSectionHeader}>
                    <Ionicons name={section.icon} size={13} color={colors.textTertiary} />
                    <Text style={[styles.drawerSectionTitle, { color: colors.textTertiary }]}>{section.title}</Text>
                  </View>
                  {section.items.map((item) => {
                    const disabled = !item.route;
                    const isLogout = item.label === 'Logout';
                    return (
                      <TouchableOpacity
                        key={`${section.title}-${item.label}`}
                        style={[styles.drawerItem, disabled && styles.drawerItemDisabled]}
                        onPress={() => handleMenuNav(item.route)}
                        disabled={disabled}
                      >
                        <Ionicons name={item.icon} size={20} color={isLogout ? colors.danger : colors.text} />
                        <Text style={[styles.drawerItemText, { color: isLogout ? colors.danger : colors.text }, disabled && [styles.drawerItemTextDisabled, { color: colors.textTertiary }]]}>{item.label}</Text>
                        {disabled && <View style={[styles.plannedDot, { backgroundColor: colors.textTertiary }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* Logout Confirmation Modal */}
      <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.logoutDialog}>
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={34} color="#EF4444" />
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
                style={[styles.confirmBtn, loggingOut && { opacity: 0.7 }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  tabIcon: { width: 38, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  floatingMenuButton: {
    position: 'absolute',
    right: Spacing.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 20,
  },
  drawer: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  drawerUser: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  drawerAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  drawerSection: { paddingVertical: 4 },
  drawerSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  drawerSectionTitle: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.2, textTransform: 'uppercase' },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20 },
  drawerItemDisabled: { opacity: 0.52 },
  drawerItemText: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  drawerItemTextDisabled: { color: '#94A3B8' },
  plannedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1', marginLeft: 'auto' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logoutDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    padding: Spacing.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  logoutIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoutTitle: {
    color: '#1E293B',
    fontSize: 22,
    fontWeight: '900',
  },
  logoutMessage: {
    color: '#64748B',
    fontSize: 14,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    textAlign: 'center',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#1E293B',
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
  confirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
