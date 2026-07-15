import { useCallback, useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  Platform, StyleSheet, View, Text, TouchableOpacity, Animated, Pressable, useWindowDimensions, ScrollView, Modal, ActivityIndicator,
  type ColorValue,
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';
import { getRoleLabel } from '../../utils/helpers';

const BOTTOM_TABS = ['dashboard', 'active', 'orders', 'materials'];
const HIDDEN_TABS = [
  'drivers',
  'drivers/[id]',
  'drivers/create',
  'trucks',
  'profile',
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
};

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
      { label: 'Dispatch Queue', icon: 'git-branch-outline', route: '/management/dispatch' },
    ],
  },
  {
    title: 'Procurement',
    icon: 'cube-outline',
    items: [
      { label: 'Purchase Orders', icon: 'document-text-outline', route: '/management/orders' },
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
      { label: 'Analytics', icon: 'stats-chart-outline', route: '/management/analytics' },
      { label: 'Issues', icon: 'chatbubble-ellipses-outline', route: '/screens/issues' },
    ],
  },
  {
    title: 'Administration',
    icon: 'settings-outline',
    items: [
      { label: 'Users', icon: 'person-add-outline', route: '/management/users' },
      { label: 'Roles', icon: 'shield-checkmark-outline', route: '/management/roles' },
      { label: 'Settings', icon: 'settings-outline', route: '/management/settings' },
      { label: 'Master Data', icon: 'server-outline', route: '/management/master-data' },
      { label: 'Profile', icon: 'person-outline', route: '/management/profile' },
      { label: 'Export Data', icon: 'cloud-download-outline', route: '/management/settings' },
      { label: 'Logout', icon: 'log-out-outline', route: '__logout__' },
    ],
  },
];

export default function ManagementLayout() {
  const { user, logout } = useAuthStore();
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const menuWidth = Math.min(screenWidth * 0.8, 320);

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
        tabBar={Platform.OS === 'web' ? () => null : undefined}
        screenOptions={{
          tabBarActiveTintColor: '#1B2A4A',
          tabBarInactiveTintColor: '#94A3B8',
          tabBarShowLabel: Platform.OS !== 'web',
          tabBarLabelStyle: Platform.OS === 'web' ? { display: 'none' } : { fontSize: 11, fontWeight: '600' },
          tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E2E8F0',
            borderTopWidth: 1,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom + 4 : 6,
            paddingTop: 6,
            height: Platform.OS === 'ios' ? 68 + insets.bottom : 68,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
          },
          headerShown: Platform.OS !== 'web',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1E293B',
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerShadowVisible: false,
          headerRight: Platform.OS === 'web' ? undefined : () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => router.push('/screens/notifications' as any)} style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
                <Ionicons name="notifications-outline" size={22} color="#1B2A4A" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleMenu} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
                <Ionicons name="menu-outline" size={24} color="#1B2A4A" />
              </TouchableOpacity>
            </View>
          ),
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
                  <View style={[styles.tabIcon, focused && { backgroundColor: '#1B2A4A12' }]}>
                    {getTabIcon(tabName, color)}
                  </View>
                ),
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
          const hideHeader = tabName === 'drivers/[id]' || tabName === 'drivers/create' || tabName === 'materials/[id]' || tabName === 'materials/create' || tabName === 'materials/edit/[id]';
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

      {/* Hamburger Drawer */}
      {menuOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleMenu} />
          </Animated.View>
          <Animated.View style={[styles.drawer, { paddingTop: insets.top + 16, backgroundColor: '#FFFFFF', width: menuWidth, transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.drawerUser}>
              <View style={[styles.drawerAvatar, { backgroundColor: '#1B2A4A15' }]}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1B2A4A' }}>{(user?.displayName || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{user?.displayName || 'User'}</Text>
              <Text style={{ fontSize: 14, color: '#64748B' }}>{user?.email || ''}</Text>
              <View style={{ marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#1B2A4A12' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B2A4A' }}>{getRoleLabel(user?.role || '')}</Text>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
              {DRAWER_SECTIONS.map((section) => (
                <View key={section.title} style={styles.drawerSection}>
                  <View style={styles.drawerSectionHeader}>
                    <Ionicons name={section.icon} size={13} color="#94A3B8" />
                    <Text style={styles.drawerSectionTitle}>{section.title}</Text>
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
                        <Ionicons name={item.icon} size={20} color={isLogout ? '#EF4444' : '#1E293B'} />
                        <Text style={[styles.drawerItemText, isLogout && { color: '#EF4444' }, disabled && styles.drawerItemTextDisabled]}>{item.label}</Text>
                        {disabled && <View style={styles.plannedDot} />}
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