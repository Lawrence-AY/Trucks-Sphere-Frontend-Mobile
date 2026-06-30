import { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  Platform, StyleSheet, View, TouchableOpacity, Modal, Text, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { Spacing, Radius } from '../../constants/theme';

const BOTTOM_TABS = ['dashboard', 'weigh-in', 'weigh-out', 'materials'];

const TAB_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  dashboard: { icon: 'clipboard-outline', label: 'Queue' },
  'weigh-in': { icon: 'download-outline', label: 'Weigh In' },
  'weigh-out': { icon: 'arrow-up-outline', label: 'Weigh Out' },
  materials: { icon: 'cube-outline', label: 'Materials' },
};

export default function OperatorQuarryLayout() {
  const { logout } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setConfirmLogout(false);
    router.replace('/(auth)/login' as any);
  };

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#1B2A4A',
          tabBarInactiveTintColor: '#94A3B8',
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: {
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
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1E293B',
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerShadowVisible: false,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => router.push('/screens/issues' as any)} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
                <Ionicons name="notifications-outline" size={22} color="#1B2A4A" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmLogout(true)} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                <Ionicons name="log-out-outline" size={20} color="#1B2A4A" />
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
      </Tabs>

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