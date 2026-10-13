import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { Gap, Radius, Spacing } from '../../constants/theme';
import { normalizeVendorId } from '../../utils/helpers';
import {
  getPendingAuthorizations,
  verifyFuelAuthorization,
} from '../../services/api';

export default function NotificationsScreen() {
  const colors = useTheme();
  const styles = buildThemeStyles(colors);
  const { user } = useAuthStore();

  const vendorId = user?.vendorId || '';
  const normalizedUserVendorId = normalizeVendorId(vendorId);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAuths, setPendingAuths] = useState<any[]>([]);
  const [activeAuth, setActiveAuth] = useState<any>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      if (!normalizedUserVendorId) return;
      const pending = await getPendingAuthorizations(normalizedUserVendorId);
      setPendingAuths(pending || []);
    } catch {
      // Silently retry
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizedUserVendorId]);

  useEffect(() => {
    fetchNotifications();
    pollingRef.current = setInterval(fetchNotifications, 30000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchNotifications]);

  const openAuthModal = (auth: any) => {
    setActiveAuth(auth);
    setOtpInput('');
    setAuthModalVisible(true);
  };

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
      await verifyFuelAuthorization(activeAuth.id, otpInput.trim(), authorize);
      if (authorize) {
        Alert.alert('Authorized', 'Fuel dispensing has been authorized.', [
          { text: 'OK', onPress: () => { closeAuthModal(); fetchNotifications(); } }
        ]);
      } else {
        Alert.alert('Denied', 'Fuel dispensing has been denied.', [
          { text: 'OK', onPress: () => { closeAuthModal(); fetchNotifications(); } }
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
    if (!expiresAt) return 'Unknown';
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins > 0) return `Expires in ${mins}m ${secs}s`;
    return `Expires in ${secs}s`;
  };

  const formatTime = (timestamp: string): string => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { timeZone: 'Africa/Nairobi',  hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchNotifications(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
           
          {pendingAuths.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingAuths.length}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primaryText} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading notifications...</Text>
          </View>
        ) : pendingAuths.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}10` }]}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              You're all caught up.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Gap}}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {pendingAuths.length} pending fuel authorization{pendingAuths.length !== 1 ? 's' : ''}
            </Text>
            {pendingAuths.map((auth, index) => (
              <TouchableOpacity
                key={auth.id || index}
                style={[styles.notificationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => openAuthModal(auth)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationRow}>
                  <View style={[styles.notificationIcon, { backgroundColor: colors.warningBg }]}>
                    <Ionicons name="water-outline" size={22} color={colors.warningText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notificationTitle, { color: colors.text }]}>
                      Fuel Authorization Request
                    </Text>
                    <Text style={[styles.notificationDetail, { color: colors.textSecondary }]}>
                      {auth.fuelAmount || 0} Litres · {auth.driverName || 'Unknown driver'} · {auth.plateNumber || 'Unknown truck'}
                    </Text>
                    <View style={styles.notificationMeta}>
                      <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                      <Text style={[styles.notificationTime, { color: colors.textMuted }]}>
                        {formatExpiry(auth.expiresAt)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
                <View style={styles.quickActions}>
                  <Text style={[styles.quickActionHint, { color: colors.textMuted }]}>
                    Tap to review & authorize
                  </Text>
                  <Ionicons name="key-outline" size={16} color={colors.accent} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* OTP Authorization Modal */}
      <Modal
        visible={authModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAuthModal}
      >
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
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={closeAuthModal}
              >
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
                        <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 14 }}>Deny</Text>
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
    </View>
  );
}

const buildThemeStyles = (colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 13, marginTop: Spacing.xs,
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Gap,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Gap,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Gap,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  notificationDetail: {
    fontSize: 13, marginTop: Spacing.xs,
    lineHeight: 18,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap, marginTop: Spacing.xs,
  },
  notificationTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Gap,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickActionHint: {
    fontSize: 12,
    fontWeight: '600',
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