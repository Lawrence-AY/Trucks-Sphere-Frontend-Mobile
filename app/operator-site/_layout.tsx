import { useFlagViewsStore, flagViewKey } from '@/store/flagViewsStore';
import { isDeliveryFlagged } from '../../utils/siteFlags';
import { useCallback, useRef, useState, useMemo } from 'react';
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
import { Gap, Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getRoleLabel } from '../../utils/helpers';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useResolvedIssuesCount } from '../../hooks/useResolvedIssuesCount';
import { useDeliveryOrders } from '@/store/realtimeData';

const BOTTOM_TABS = ['schedule', 'weights', 'history'];
// These routes are opened from visible screens but are not primary tab destinations.
const SECONDARY_ROUTES = ['dashboard', 'profile', 'settings', 'receive', 'materials', 'downloads', 'flagged'];

const TAB_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  schedule: { icon: 'calendar-outline', label: 'Schedule' },
  weights: { icon: 'scale-outline', label: 'Weights' },
  history: { icon: 'time-outline', label: 'History' },
};

// Menu items for operator site drawer — includes Issues
const MENU_ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: 'Issues', icon: 'warning-outline', route: '/screens/issues' },
  { label: 'Profile', icon: 'person-outline', route: '/operator-site/profile' },
  { label: 'Logout', icon: 'log-out-outline', route: '__logout__' },
];

export default function OperatorSiteLayout() {
  const colors = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const resolvedIssuesCount = useResolvedIssuesCount();
  const deliveries = useDeliveryOrders();
  const viewedFlags = useFlagViewsStore((state) => state.viewed);
  const { user, logout } = useAuthStore();
  const flaggedDeliveriesCount = deliveries.filter((job) => isDeliveryFlagged(job) && !viewedFlags[flagViewKey(user?.uid || '', job)]).length;
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
                onPress={() => router.push('/operator-site/flagged' as any)}
                style={{ paddingHorizontal: 6, paddingVertical: 8, position: 'relative' }}
              >
                <Ionicons name={flaggedDeliveriesCount > 0 ? 'flag' : 'flag-outline'} size={21} color={flaggedDeliveriesCount > 0 ? colors.warningText : colors.danger} />
                {flaggedDeliveriesCount > 0 ? <View style={styles.flagBadge}><Text style={styles.flagBadgeText}>{flaggedDeliveriesCount > 99 ? '99+' : flaggedDeliveriesCount}</Text></View> : null}
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open site menu" onPress={toggleMenu} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
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
                  <View style={[styles.tabIcon, focused && { backgroundColor: `${colors.primary}12` }]}>
                    <Ionicons name={config?.icon || 'ellipse'} size={22} color={color} />
                  </View>
                ),
              }}
            />
          );
        })}
        <Tabs.Screen name="weigh-in" options={{ href: null, headerShown: false }} />
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
              { backgroundColor: colors.overlay, opacity: fadeAnim },
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
              {MENU_ITEMS.filter(item => Platform.OS === 'web' || !BOTTOM_TABS.some(tab => item.route === '/operator-site/' + tab)).map((item) => (
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
                  {item.label === 'Issues' && resolvedIssuesCount > 0 && (
                    <View style={styles.resolvedIssueBadge}>
                      <Text style={styles.resolvedIssueBadgeText}>{resolvedIssuesCount > 99 ? '99+' : resolvedIssuesCount}</Text>
                    </View>
                  )}
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
                  <ActivityIndicator color={colors.onPrimary} size="small" />
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

const buildStyles = (colors: any) =>
  StyleSheet.create({
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
    borderBottomColor: colors.border,
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
    gap: Gap,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logoutDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    padding: Spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  logoutIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xs,
  },
  logoutTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  logoutMessage: {
    color: colors.textMuted,
    fontSize: 14, marginTop: Spacing.xs, marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  logoutActions: {
    flexDirection: 'row',
    gap: Gap,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  resolvedIssueBadge: { marginLeft: 'auto', minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  resolvedIssueBadgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '800' },
  flagBadge: { position: 'absolute', top: 2, right: -2, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: '#B45309', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  flagBadgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '800' },
  });
