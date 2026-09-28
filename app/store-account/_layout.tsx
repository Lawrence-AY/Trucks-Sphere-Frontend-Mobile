import { Redirect, Tabs, router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { normalizeRole } from '../../utils/access';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggle } from '../../components/ThemeToggle';
import { getRoleLabel } from '../../utils/helpers';

export default function StoreAccountLayout() {
  const { user, logout } = useAuthStore();
  const role = normalizeRole(user?.role);
  const colors = useTheme();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  if (role !== 'storeman') return <Redirect href="/(auth)/login" />;
  const go = (route: '/store-account' | '/store-account/history' | '/store-account/profile' | '/store-account/inventory') => { setMenuOpen(false); router.push(route as any); };
  const header = Platform.OS === 'web' ? undefined : () => <TouchableOpacity onPress={() => setMenuOpen(true)} accessibilityLabel="Open store account menu"><Ionicons name="menu-outline" size={28} color={colors.text} /></TouchableOpacity>;
  const back = Platform.OS === 'web' || pathname === '/store-account' ? undefined : () => <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>;
  return <>
    <Tabs screenOptions={{
      headerShown: true,
      headerLeft: back,
      headerRight: header,
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { color: colors.text },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : { backgroundColor: colors.surface, borderTopColor: colors.border, width: '100%', justifyContent: 'center', alignItems: 'stretch' },
      tabBarItemStyle: { flexGrow: 0, flexShrink: 0, flexBasis: '33.333%', width: '33.333%', maxWidth: '33.333%', alignItems: 'center', justifyContent: 'center' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Receiving', tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarButton: () => null, title: 'Profile' }} />
      <Tabs.Screen name="inventory/[id]" options={{ tabBarButton: () => null, title: 'Inventory details' }} />
      <Tabs.Screen name="[id]" options={{ tabBarButton: () => null, title: 'Receiving details' }} />
    </Tabs>
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}><View style={styles.backdrop}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} /><View style={[styles.menu, { backgroundColor: colors.surface }]}><View style={[styles.user, { borderBottomColor: colors.border }]}><View style={[styles.avatar, { backgroundColor: `${colors.accent}18` }]}><Text style={{ color: colors.accent, fontSize: 20, fontWeight: '700' }}>{(user?.displayName || 'U').charAt(0).toUpperCase()}</Text></View><Text style={[styles.title, { color: colors.text }]}>{user?.displayName || 'User'}</Text><Text style={{ color: colors.accent }}>{getRoleLabel(user?.role || 'storeman')}</Text></View><ScrollView><ThemeToggle /><TouchableOpacity style={styles.item} onPress={() => go('/store-account/profile')}><Ionicons name="person-outline" size={20} color={colors.text} /><Text style={{ color: colors.text }}>Profile</Text></TouchableOpacity><TouchableOpacity style={styles.item} onPress={async () => { setMenuOpen(false); await logout(); router.replace('/(auth)/login' as any); }}><Ionicons name="log-out-outline" size={20} color={colors.danger} /><Text style={{ color: colors.danger }}>Logout</Text></TouchableOpacity></ScrollView></View></View></Modal>
  </>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'flex-end' }, menu: { width: 300, height: '100%', paddingTop: 54 }, user: { alignItems: 'center', paddingVertical: 24, borderBottomWidth: 1 }, avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, title: { fontSize: 18, fontWeight: '800', marginBottom: 8 }, item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1' } });
