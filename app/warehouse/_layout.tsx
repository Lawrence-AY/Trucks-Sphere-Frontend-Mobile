import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { isManagementRole, normalizeRole } from '../../utils/access';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme, useThemeMode } from '../../hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { getRoleLabel } from '../../utils/helpers';
import { canControlStatusBarAppearance } from '../../utils/statusBar';

export default function WarehouseLayout() {
  const colors = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const showManagementBackButton = isManagementRole(user?.role) && router.canGoBack();
  const isWarehouseOperator = normalizeRole(user?.role) === 'operator_warehouse';
  const closeMenu = () => setMenuVisible(false);
  const goTo = (route: '/warehouse' | '/warehouse/history' | '/warehouse/reports' | '/warehouse/profile') => {
    closeMenu();
    router.push(route as any);
  };
  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setMenuVisible(false);
    router.replace('/(auth)/login' as any);
  };
  return (
    <>
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 17, color: colors.text },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarHideOnKeyboard: true,
        tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6) + 4,
          height: 68 + Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Shipments',
          tabBarLabel: 'Shipments',
          tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={22} color={color} />,
          headerLeft: showManagementBackButton ? () => (
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back to management" style={{ padding: 8, marginLeft: -8 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : undefined,
          headerRight: isWarehouseOperator ? () => (
            <TouchableOpacity onPress={() => setMenuVisible(true)} accessibilityLabel="Warehouse menu" style={{ padding: 8, marginRight: -8 }}>
              <Ionicons name="menu-outline" size={25} color={colors.text} />
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: null,
          title: 'Warehouse Reports',
          headerRight: isWarehouseOperator ? () => (
            <TouchableOpacity onPress={() => setMenuVisible(true)} accessibilityLabel="Warehouse menu" style={{ padding: 8, marginRight: -8 }}>
              <Ionicons name="menu-outline" size={25} color={colors.text} />
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Shipment History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={22} color={color} />,
          headerRight: isWarehouseOperator ? () => (
            <TouchableOpacity onPress={() => setMenuVisible(true)} accessibilityLabel="Warehouse menu" style={{ padding: 8, marginRight: -8 }}>
              <Ionicons name="menu-outline" size={25} color={colors.text} />
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
    </Tabs>
      {canControlStatusBarAppearance ? (
        <StatusBar
          animated
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.surface}
          translucent={false}
        />
      ) : null}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={styles.drawerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          <View style={[styles.drawer, { backgroundColor: colors.surface }]}> 
            <View style={[styles.drawerUser, { borderBottomColor: colors.border }]}> 
              <View style={[styles.drawerAvatar, { backgroundColor: `${colors.primary}18` }]}>
                <Text style={[styles.drawerAvatarText, { color: colors.primary }]}>{(user?.displayName || user?.email || 'W').charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.drawerName, { color: colors.text }]}>{user?.displayName || 'Warehouse user'}</Text>
              <Text style={[styles.drawerRole, { color: colors.textMuted }]}>{getRoleLabel(user?.role || 'operator_warehouse')}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.drawerContent}>
              <ThemeToggle />
              <MenuItem icon="cube-outline" label="My shipments" onPress={() => goTo('/warehouse')} />
              <MenuItem icon="time-outline" label="History" onPress={() => goTo('/warehouse/history')} />
              <MenuItem icon="bar-chart-outline" label="Reports" onPress={() => goTo('/warehouse/reports')} />
              <MenuItem icon="person-outline" label="Profile" onPress={() => goTo('/warehouse/profile')} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <MenuItem icon="log-out-outline" label="Logout" danger onPress={handleLogout} loading={loggingOut} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MenuItem({ icon, label, onPress, danger = false, loading = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; loading?: boolean }) {
  const colors = useTheme();
  const color = danger ? colors.danger : colors.text;
  return <TouchableOpacity style={styles.menuItem} onPress={onPress} disabled={loading}>
    {loading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={21} color={color} />}
    <Text style={[styles.menuItemText, { color }]}>{label}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', alignItems: 'flex-end' },
  drawer: { width: '80%', maxWidth: 320, height: '100%', shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  drawerUser: { alignItems: 'center', paddingTop: 54, paddingBottom: Spacing.lg, borderBottomWidth: 1 },
  drawerAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs},
  drawerAvatarText: { fontSize: 20, fontWeight: '800' },
  drawerName: { fontSize: 16, fontWeight: '800' },
  drawerRole: { fontSize: 13, fontWeight: '600', marginTop: Spacing.xs},
  drawerContent: { paddingVertical: Spacing.sm },
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  menuItemText: { fontSize: 15, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs},
});
 
