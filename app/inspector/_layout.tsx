import { router } from '../../utils/router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Spacing, Radius } from '../../constants/theme';
import { getRoleLabel } from '../../utils/helpers';
import { useResolvedIssuesCount } from '../../hooks/useResolvedIssuesCount';
import { getInspectorSelection } from '../../utils/inspectorSelection';

const MENU_ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  // On web the bottom tab bar is hidden, so expose the same destinations
  // from the sidebar. Keeping them here also makes the menu uniform.
  { label: 'Inspections', icon: 'clipboard-outline', route: '/inspector' },
  { label: 'History', icon: 'time-outline', route: '/inspector/history' },
  { label: 'Issues', icon: 'warning-outline', route: '/screens/issues' },
  { label: 'Profile', icon: 'person-outline', route: '/inspector/profile' },
  { label: 'Logout', icon: 'log-out-outline', route: '__logout__' },
];

/** Matches the Operator Site drawer interaction and visual language. */
export default function InspectorLayout() {
  const colors = useTheme();
  const { user, logout } = useAuthStore();
  const resolvedIssuesCount = useResolvedIssuesCount();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuWidth = Math.min(width * .8, 320);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const toggleMenu = useCallback(() => {
    if (menuOpen) Animated.parallel([Animated.timing(slideAnim, { toValue: menuWidth, duration: 200, useNativeDriver: true }), Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true })]).start(() => setMenuOpen(false));
    else { setMenuOpen(true); slideAnim.setValue(menuWidth); Animated.parallel([Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }), Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true })]).start(); }
  }, [fadeAnim, menuOpen, menuWidth, slideAnim]);
  const navigate = (route: string) => { if (route === '__logout__') { setConfirmLogout(true); return; } toggleMenu(); setTimeout(() => router.push(route as any), 250); };
  const signOut = async () => { setLoggingOut(true); await logout(); setLoggingOut(false); setConfirmLogout(false); setMenuOpen(false); router.replace('/(auth)/login' as any); };
  const headerRight = () => <View style={{ flexDirection: 'row', alignItems: 'center' }}><TouchableOpacity onPress={() => router.push('/screens/issues' as any)} style={styles.headerButton}><Ionicons name="warning-outline" size={22} color="#EF4444" />{resolvedIssuesCount > 0 ? <View style={styles.issueBadge}><Text style={styles.issueBadgeText}>{resolvedIssuesCount}</Text></View> : null}</TouchableOpacity>{Platform.OS !== 'web' ? <TouchableOpacity onPress={toggleMenu} style={styles.headerButton}><Ionicons name="menu-outline" size={25} color={colors.text} /></TouchableOpacity> : null}</View>;
  return <>
    <Tabs backBehavior="fullHistory" screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' }, headerRight, tabBarHideOnKeyboard: true, tabBarActiveTintColor: '#10B981', tabBarInactiveTintColor: colors.tabInactive, tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, paddingBottom: Math.max(insets.bottom, 6) + 4, paddingTop: 6, height: 68 + Math.max(insets.bottom, 6) }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
      <Tabs.Screen name="index" options={{ title: 'Inspection', tabBarLabel: 'Inspections', tabBarIcon: ({ color }) => <Ionicons name="clipboard-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Inspection History', tabBarLabel: 'History', tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="inspect/[id]" options={{ href: null, title: 'PO: ' + (getInspectorSelection()?.poNumber || 'Material Inspection'), headerLeft: () => <TouchableOpacity accessibilityLabel="Back to inspections" onPress={() => router.back()} style={styles.headerButton}><Ionicons name="arrow-back" size={23} color={colors.text} /></TouchableOpacity> }} />
    </Tabs>
    {Platform.OS !== 'web' && menuOpen ? <View style={StyleSheet.absoluteFill} pointerEvents="box-none"><Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,.35)', opacity: fadeAnim }]}><Pressable style={StyleSheet.absoluteFill} onPress={toggleMenu} /></Animated.View><Animated.View style={[styles.drawer, { paddingTop: insets.top + 16, backgroundColor: colors.surface, width: menuWidth, transform: [{ translateX: slideAnim }] }]}><View style={[styles.drawerUser, { borderBottomColor: colors.border }]}><View style={[styles.avatar, { backgroundColor: `${colors.accent}18` }]}><Text style={{ fontSize: 20, fontWeight: '700', color: colors.accent }}>{(user?.displayName || 'U').charAt(0).toUpperCase()}</Text></View><Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.displayName || 'User'}</Text><View style={[styles.rolePill, { backgroundColor: `${colors.accent}18` }]}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.accent }}>{getRoleLabel(user?.role || '')}</Text></View></View><ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}><ThemeToggle/>{MENU_ITEMS.map((item) => <TouchableOpacity key={item.label} style={styles.drawerItem} onPress={() => navigate(item.route)}><Ionicons name={item.icon} size={20} color={item.label === 'Logout' ? colors.danger : item.label === 'Issues' ? colors.warning : colors.text}/><Text style={{ fontSize: 16, fontWeight: '600', color: item.label === 'Logout' ? colors.danger : colors.text }}>{item.label}</Text></TouchableOpacity>)}</ScrollView></Animated.View></View> : null}
    <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}><View style={styles.modalBackdrop}><View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.logoutIcon, { backgroundColor: `${colors.danger}18` }]}><Ionicons name="log-out-outline" size={34} color={colors.danger}/></View><Text style={[styles.dialogTitle, { color: colors.text }]}>Logout</Text><Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg }}>Are you sure you want to logout?</Text><View style={styles.actions}><TouchableOpacity style={[styles.cancel, { backgroundColor: colors.inputBg }]} onPress={() => setConfirmLogout(false)} disabled={loggingOut}><Text style={{ color: colors.text, fontWeight: '800' }}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.confirm} onPress={() => { void signOut(); }} disabled={loggingOut}>{loggingOut ? <ActivityIndicator color="#fff" size="small"/> : <Text style={{ color: '#fff', fontWeight: '800' }}>Logout</Text>}</TouchableOpacity></View></View></View></Modal>
  </>;
}
const styles = StyleSheet.create({ headerButton:{paddingHorizontal:8,paddingVertical:8,position:'relative'},issueBadge:{position:'absolute',top:3,right:0,minWidth:15,height:15,paddingHorizontal:3,borderRadius:8,backgroundColor:'#10B981',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#fff'},issueBadgeText:{color:'#fff',fontSize:9,fontWeight:'800'},drawer:{position:'absolute',top:0,right:0,bottom:0},drawerUser:{alignItems:'center',paddingVertical:24,paddingHorizontal:16,borderBottomWidth:1},avatar:{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',marginBottom:Spacing.xs},rolePill:{marginTop:Spacing.xs,paddingHorizontal:12,paddingVertical:4,borderRadius:999},drawerItem:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,paddingHorizontal:20},modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.45)',alignItems:'center',justifyContent:'center',padding:Spacing.xl},dialog:{width:'100%',maxWidth:340,borderRadius:18,padding:Spacing.xl,borderWidth:1,alignItems:'center'},logoutIcon:{width:66,height:66,borderRadius:22,alignItems:'center',justifyContent:'center',marginBottom:Spacing.xs},dialogTitle:{fontSize:22,fontWeight:'900',marginBottom:Spacing.xs},actions:{flexDirection:'row',gap:Spacing.md,width:'100%'},cancel:{flex:1,height:48,borderRadius:Radius.md,alignItems:'center',justifyContent:'center'},confirm:{flex:1,height:48,borderRadius:Radius.md,backgroundColor:'#EF4444',alignItems:'center',justifyContent:'center'} });
