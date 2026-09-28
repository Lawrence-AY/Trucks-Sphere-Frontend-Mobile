import { useCallback, useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Pressable,
  useWindowDimensions,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Spacing, Radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getRoleLabel } from '../../utils/helpers';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useResolvedIssuesCount } from '../../hooks/useResolvedIssuesCount';

const BOTTOM_TABS = ['dashboard', 'weigh-in', 'weigh-out', 'history'];
// These routes are opened from visible screens but are not primary tab destinations.
const SECONDARY_ROUTES = ['profile', 'settings', 'materials'];

const TAB_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  dashboard: { icon: 'clipboard-outline', label: 'Queue' },
  'weigh-in': { icon: 'download-outline', label: 'Weigh In' },
  'weigh-out': { icon: 'arrow-up-outline', label: 'Weigh Out' },
  history: { icon: 'time-outline', label: 'History' },
};

// Menu items for quarry operator drawer
const MENU_ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: 'Issues', icon: 'warning-outline', route: '/screens/issues' },
  { label: 'Profile', icon: 'person-outline', route: '/operator-quarry/profile' },
  { label: 'Logout', icon: 'log-out-outline', route: '__logout__' },
];

export default function OperatorQuarryLayout() {
  const colors = useTheme();
  const resolvedIssuesCount = useResolvedIssuesCount();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBottomInset = Math.max(insets.bottom, 6);
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

  const handleMenuNav = (route: string) => {
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
    <>
      <Tabs backBehavior="fullHistory"
        tabBar={Platform.OS === 'web' ? () => null : undefined}
        screenOptions={{
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: Platform.OS !== 'web',
          tabBarLabelStyle: Platform.OS === 'web' ? { display: 'none' } : { fontSize: 11, fontWeight: '600' },
          // Keep this tab bar in the normal layout flow. The dashboard FAB is
          // then positioned above it instead of being covered by a floating bar.
          tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingBottom: tabBottomInset + 4,
            paddingTop: 6,
            height: 68 + tabBottomInset,
          },
          headerShown: Platform.OS !== 'web',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerShadowVisible: false,
          headerRight: Platform.OS === 'web' ? undefined : () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => router.push('/screens/issues' as any)}
                style={{ paddingHorizontal: 6, paddingVertical: 8, position: 'relative' }}
              >
                <Ionicons name="warning-outline" size={22} color="#EF4444" />
                {resolvedIssuesCount > 0 && (
                  <View style={styles.resolvedIssueBadge}>
                    <Text style={styles.resolvedIssueBadgeText}>{resolvedIssuesCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleMenu} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
                <Ionicons name="menu-outline" size={24} color={colors.text} />
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
                  <View style={[styles.tabIcon, focused && { backgroundColor: '#229ED912' }]}>
                    <Ionicons name={config?.icon || 'ellipse'} size={22} color={color} />
                  </View>
                ),
              }}
            />
          );
        })}
        {SECONDARY_ROUTES.map((tabName) => (
          <Tabs.Screen key={tabName} name={tabName} options={{ href: null }} />
        ))}
      </Tabs>

      {/* Hamburger Drawer */}
      {menuOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.35)', opacity: fadeAnim },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={toggleMenu} />
          </Animated.View>
          <Animated.View
            style={[ 
              styles.drawer,
              {
                paddingTop: insets.top + 16,
                backgroundColor: colors.surface,
                width: menuWidth,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={[styles.drawerUser, { borderBottomColor: colors.border }]}>
              <View style={[styles.drawerAvatar, { backgroundColor: `${colors.accent}18` }]}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.accent }}>
                  {(user?.displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {user?.displayName || 'User'}
              </Text>
              <View style={{ marginTop: Spacing.xs, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: `${colors.accent}18` }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accent }}>
                  {getRoleLabel(user?.role || '')}
                </Text>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
              <ThemeToggle />
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.drawerItem}
                  onPress={() => handleMenuNav(item.route)}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.label === 'Logout' ? colors.danger : item.label === 'Issues' ? colors.warning : colors.text}
                  />
                  <Text
                    style={[
                      styles.drawerItemText,
                      { color: item.label === 'Logout' ? colors.danger : colors.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* Logout Confirmation Modal */}
      <Modal
        visible={confirmLogout}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmLogout(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.logoutDialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.logoutIcon, { backgroundColor: `${colors.danger}18` }]}>
              <Ionicons name="log-out-outline" size={34} color={colors.danger} />
            </View>
            <Text style={[styles.logoutTitle, { color: colors.text }]}>Logout</Text>
            <Text style={[styles.logoutMessage, { color: colors.textMuted }]}>Are you sure you want to logout?</Text>
            <View style={styles.logoutActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]}
                onPress={() => setConfirmLogout(false)}
                disabled={loggingOut}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 38,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
  drawerUser: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  drawerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xs,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
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
    justifyContent: 'center', marginBottom: Spacing.xs,
  },
  logoutTitle: {
    color: '#1E293B',
    fontSize: 22,
    fontWeight: '900',
  },
  logoutMessage: {
    color: '#64748B',
    fontSize: 14, marginTop: Spacing.xs, marginBottom: Spacing.xs,
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
  resolvedIssueBadge: {
    position: 'absolute',
    top: 3,
    right: 0,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  resolvedIssueBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
