import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useAuthStore } from '../../store/authStore';
import { Spacing, Radius } from '../../constants/theme';
import { getRoleLabel, normalizeVendorId } from '../../utils/helpers';
import {
  getPendingAuthorizations,
  verifyFuelAuthorization,
} from '../../services/api';

const BOTTOM_TABS = ['dashboard', 'trips', 'orders', 'materials'];
const HIDDEN_TABS = ['drivers', 'trucks', 'profile', 'settings'];

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
  { label: 'Settings', icon: 'settings-outline', route: '/management/settings' },
  { label: 'Fuel', icon: 'water-outline', route: '/vendor/fuel' },
  { label: 'Logout', icon: 'log-out-outline', route: '__logout__' },
];

export default function VendorLayout() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
              {/* Pending auth notification bell */}
              <TouchableOpacity
                onPress={() => {
                  router.push('/screens/notifications' as any);
                }}
                style={{ paddingHorizontal: 6, paddingVertical: 8, position: 'relative' }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={pendingAuths.length > 0 ? '#EF4444' : '#1B2A4A'}
                />
                {pendingAuths.length > 0 && (
                  <View style={styles.authBadge}>
                    <Text style={styles.authBadgeText}>{pendingAuths.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
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
                  <Ionicons name="key-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
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
                    <Ionicons name={config?.icon || 'ellipse'} size={22} color={color} />
                  </View>
                ),
              }}
            />
          );
        })}
        {HIDDEN_TABS.map((tabName) => (
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
                backgroundColor: '#FFFFFF',
                width: menuWidth,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.drawerUser}>
              <View style={[styles.drawerAvatar, { backgroundColor: '#1B2A4A15' }]}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1B2A4A' }}>
                  {(user?.displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>
                {user?.displayName || 'User'}
              </Text>
              <Text style={{ fontSize: 14, color: '#64748B' }}>{user?.email || ''}</Text>
              <View style={{ marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#1B2A4A12' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1B2A4A' }}>
                  {getRoleLabel(user?.role || '')}
                </Text>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.drawerItem}
                  onPress={() => handleMenuNav(item.route)}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.label === 'Logout' ? '#EF4444' : '#1E293B'}
                  />
                  <Text
                    style={[
                      styles.drawerItemText,
                      item.label === 'Logout' && { color: '#EF4444' },
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

      {/* ===================== Fuel Authorization Modal (Root-Level) ===================== */}
      <Modal visible={authModalVisible} transparent animationType="slide" onRequestClose={closeAuthModal}>
        <View style={styles.authOverlay}>
          <View style={[styles.authModalContent, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
            {/* Header */}
            <View style={styles.authModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.authModalTitle}>Fuel Authorization</Text>
                <Text style={styles.authModalSubtitle}>
                  A fuel operator is requesting authorization to dispense fuel
                </Text>
              </View>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: '#F1F5F9' }]} onPress={closeAuthModal}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {activeAuth && (
              <>
                {/* Request Details */}
                <View style={[styles.authDetailCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                  <View style={styles.authDetailRow}>
                    <Ionicons name="water-outline" size={20} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Fuel Amount</Text>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: '#F59E0B' }}>
                        {activeAuth.fuelAmount || 0} Litres
                      </Text>
                    </View>
                  </View>

                  <View style={styles.authDivider} />

                  <View style={styles.authDetailRow}>
                    <Ionicons name="person-outline" size={20} color="#3B82F6" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Driver</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>
                        {activeAuth.driverName || 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.authDetailRow}>
                    <Ionicons name="car-outline" size={20} color="#10B981" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Truck</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>
                        {activeAuth.plateNumber || 'Unknown'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.authDetailRow}>
                    <Ionicons name="time-outline" size={20} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Validity</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#F59E0B' }}>
                        {formatExpiry(activeAuth.expiresAt)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* OTP Input */}
                <View style={styles.otpSection}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: Spacing.sm }}>
                    Enter Fuel Authorization PIN sent to your phone
                  </Text>
                  <TextInput
                    style={[styles.otpInput, { color: '#1E293B', backgroundColor: '#F8FAFC', borderColor: '#3B82F6' }]}
                    placeholder="Enter 6-digit PIN"
                    placeholderTextColor="#94A3B8"
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
                    style={[styles.denyButton, { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }]}
                    onPress={() => handleAuthorize(false)}
                    disabled={authSubmitting}
                    activeOpacity={0.7}
                  >
                    {authSubmitting ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 14 }}>Not Authorize</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.authorizeButton, { backgroundColor: '#10B981' }]}
                    onPress={() => handleAuthorize(true)}
                    disabled={authSubmitting}
                    activeOpacity={0.7}
                  >
                    {authSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Authorize</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
    justifyContent: 'center',
    marginBottom: 12,
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

  // Auth notification badge
  authBadge: {
    position: 'absolute',
    top: 2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  // Auth Modal Styles
  authOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  authModalTitle: {
    color: '#1E293B',
    fontSize: 20,
    fontWeight: '900',
  },
  authModalSubtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
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
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  authDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  authDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: Spacing.xs,
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
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
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
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    minHeight: 52,
  },
});
