import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Gap, Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getRoleLabel, normalizeVendorId } from '../../utils/helpers';
import { ThemeToggle } from '../../components/ThemeToggle';
import {
  getPendingAuthorizations,
  verifyFuelAuthorization,
} from '../../services/api';

const BOTTOM_TABS = ['dashboard', 'trips', 'orders', 'materials'];
// These routes are opened from visible screens but are not primary tab destinations.
const SECONDARY_ROUTES = ['drivers', 'trucks', 'profile', 'settings', 'fuel', 'reports'];

const TAB_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  dashboard: { icon: 'home-outline', label: 'Home' },
  trips: { icon: 'layers-outline', label: 'Trips' },
  drivers: { icon: 'people-outline', label: 'Drivers' },
  trucks: { icon: 'car-outline', label: 'Trucks' },
  orders: { icon: 'document-text-outline', label: 'Orders' },
  materials: { icon: 'cube-outline', label: 'Materials' },
};

const MENU_ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: 'Drivers', icon: 'people-outline', route: '/vendor/drivers' },
  { label: 'Trucks', icon: 'car-outline', route: '/vendor/trucks' },
  { label: 'Profile', icon: 'person-outline', route: '/vendor/profile' },
  { label: 'Reports', icon: 'bar-chart-outline', route: '/vendor/reports' },
  { label: 'Fuel', icon: 'water-outline', route: '/vendor/fuel' },
  { label: 'Logout', icon: 'log-out-outline', route: '__logout__' },
];

export default function VendorLayout() {
  const colors = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
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

  // ===================== Fuel Authorization (Root-level) =====================

  const vendorId = user?.vendorId || '';
  const normalizedUserVendorId = normalizeVendorId(vendorId);

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [pendingAuths, setPendingAuths] = useState<any[]>([]);
  const [activeAuth, setActiveAuth] = useState<any>(null);
  const [otpInput, setOtpInput] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for pending fuel authorization requests
  const checkPendingAuth = async () => {
    try {
      if (!normalizedUserVendorId) return;
      const pending = await getPendingAuthorizations(normalizedUserVendorId);
      setPendingAuths(pending || []);

      // If there's a new pending request, show the modal
      if (pending.length > 0 && !authModalVisible && !activeAuth) {
        setActiveAuth(pending[0]);
        setOtpInput('');
        setAuthModalVisible(true);
      }
    } catch {
      // Silently retry
    }
  };

  useEffect(() => {
    checkPendingAuth();
    pollingRef.current = setInterval(checkPendingAuth, 30000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [normalizedUserVendorId]);

  const closeAuthModal = () => {
    setAuthModalVisible(false);
    setActiveAuth(null);
    setOtpInput('');
    setAuthSubmitting(false);
  };

  const handleAuthorize = async (authorize: boolean) => {
    if (!activeAuth?.id) {
      Alert.alert('Error', 'No active authorization request.');
      return;
    }
    if (!otpInput.trim()) {
      Alert.alert('Missing PIN', 'Please enter the Fuel Authorization PIN sent to your phone.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const result = await verifyFuelAuthorization(activeAuth.id, otpInput.trim(), authorize);
      if (authorize) {
        Alert.alert('Authorized', 'Fuel dispensing has been authorized.', [
          { text: 'OK', onPress: () => closeAuthModal() }
        ]);
      } else {
        Alert.alert('Denied', 'Fuel dispensing has been denied.', [
          { text: 'OK', onPress: () => closeAuthModal() }
        ]);
      }
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || error?.message || 'Verification failed';
      Alert.alert('Error', errMsg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const formatExpiry = (expiresAt: string): string => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins > 0) return `Expires in ${mins}m ${secs}s`;
    return `Expires in ${secs}s`;
  };

  // ===================== Hamburger Menu =====================

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

  // ===================== Render =====================

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
            elevation: 0,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0,
            shadowRadius: 0,
          },
          headerShown: Platform.OS !== 'web',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerShadowVisible: false,
          headerRight: Platform.OS === 'web' ? undefined : () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Pending auth quick-access key icon */}
              {pendingAuths.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setActiveAuth(pendingAuths[0]);
                    setOtpInput('');
                    setAuthModalVisible(true);
                  }}
                  style={{ paddingHorizontal: 4, paddingVertical: 8 }}
                >
                  <Ionicons name="key-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              )}
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
                  <View style={[styles.tabIcon, focused && { backgroundColor: `${colors.primary}12` }]}>
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
              {MENU_ITEMS.filter(item => Platform.OS === 'web' || !BOTTOM_TABS.some(tab => item.route === '/vendor/' + tab)).map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.drawerItem}
                  onPress={() => handleMenuNav(item.route)}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.label === 'Logout' ? colors.danger : colors.text}
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
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Text style={styles.confirmText}>Logout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================== Fuel Authorization Modal (Root-Level) ===================== */}
      <Modal visible={authModalVisible} transparent animationType="slide" onRequestClose={closeAuthModal}>
        <View style={styles.authOverlay}>
          <View style={[styles.authModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.authModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.authModalTitle, { color: colors.text }]}>Fuel Authorization</Text>
                <Text style={[styles.authModalSubtitle, { color: colors.textMuted }]}>
                  A fuel operator is requesting authorization to dispense fuel
                </Text>
              </View>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.surfaceVariant }]} onPress={closeAuthModal}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {activeAuth && (
              <>
                {/* Request Details */}
                <View style={[styles.authDetailCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <View style={styles.authDetailRow}>
                    <Ionicons name="water-outline" size={20} color={colors.warningText} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Fuel Amount</Text>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.warningText }}>
                        {activeAuth.fuelAmount || 0} Litres
                      </Text>
                    </View>
                  </View>

                  <View style={styles.authDivider} />

                  <View style={styles.authDetailRow}>
                    <Ionicons name="person-outline" size={20} color={colors.infoText} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Driver</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {activeAuth.driverName || 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.authDetailRow}>
                    <Ionicons name="car-outline" size={20} color={colors.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Truck</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {activeAuth.plateNumber || 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.authDetailRow}>
                    <Ionicons name="time-outline" size={20} color={colors.warningText} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Validity</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.warningText }}>
                        {formatExpiry(activeAuth.expiresAt)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* OTP Input */}
                <View style={styles.otpSection}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: Spacing.xs}}>
                    Enter Fuel Authorization PIN sent to your phone
                  </Text>
                  <TextInput inputAccessoryViewID="trucksphere-keyboard-done"
                    style={[styles.otpInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.infoBorder }]}
                    placeholder="Enter 6-digit PIN"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpInput}
                    onChangeText={setOtpInput}
                    autoFocus
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.authActions}>
                  <TouchableOpacity
                    style={[styles.denyButton, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }]}
                    onPress={() => handleAuthorize(false)}
                    disabled={authSubmitting}
                    activeOpacity={0.7}
                  >
                    {authSubmitting ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                        <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 14 }}>Not Authorize</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.authorizeButton, { backgroundColor: colors.success }]}
                    onPress={() => handleAuthorize(true)}
                    disabled={authSubmitting}
                    activeOpacity={0.7}
                  >
                    {authSubmitting ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={20} color={colors.onPrimary} />
                        <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 14 }}>Authorize</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    shadowColor: colors.text,
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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

  // Auth notification badge
  authBadge: {
    position: 'absolute',
    top: 2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authBadgeText: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: '900',
  },

  // Auth Modal Styles
  authOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  authModalContent: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    maxHeight: '85%',
  },
  authModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Gap, marginBottom: Spacing.xs,
  },
  authModalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  authModalSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18, marginTop: Spacing.xs,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authDetailCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg, marginBottom: Spacing.xs,
  },
  authDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap,
    paddingVertical: Spacing.sm,
  },
  authDivider: {
    height: 1,
    backgroundColor: colors.border, marginVertical: Spacing.xs,
  },
  otpSection: {},
  otpInput: {
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
  },
  authActions: {
    flexDirection: 'row',
    gap: Gap, marginTop: Spacing.xs,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Gap,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    minHeight: 52,
  },
  authorizeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Gap,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    minHeight: 52,
  },
  });
