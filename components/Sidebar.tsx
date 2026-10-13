import React, { useMemo, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
  Modal,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter, usePathname } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useTheme, useThemeMode } from '../hooks/useTheme';
import { Gap, Spacing } from '../constants/theme';
import { getRoleLabel } from '../utils/helpers';
import { showConfirm } from '../utils/webAlert';
import type { UserRole } from '@/store/types';
import { isManagementRole, managementHomeRoute, normalizeRole } from '../utils/access';
import { getManagementNavigation } from '../utils/managementNavigation';
import { ThemeToggle } from './ThemeToggle';
import { useResolvedIssuesCount } from '../hooks/useResolvedIssuesCount';

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  roles?: UserRole[];
  activeRoutes?: string[];
  exactActive?: boolean;
};

type NavSection = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: NavItem[];
};

const ROLE_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    icon: 'apps-outline',
    items: [
      { label: 'Dashboard', icon: 'home-outline', route: '/vendor/dashboard', roles: ['vendor'], activeRoutes: ['/vendor/dashboard'] },
      { label: 'Trips', icon: 'layers-outline', route: '/vendor/trips', roles: ['vendor'], activeRoutes: ['/vendor/trips'] },
      { label: 'Drivers', icon: 'people-outline', route: '/vendor/drivers', roles: ['vendor'], activeRoutes: ['/vendor/drivers'] },
      { label: 'Trucks', icon: 'car-outline', route: '/vendor/trucks', roles: ['vendor'], activeRoutes: ['/vendor/trucks'] },
      { label: 'Orders', icon: 'document-text-outline', route: '/vendor/orders', roles: ['vendor'], activeRoutes: ['/vendor/orders'] },
      { label: 'Materials', icon: 'cube-outline', route: '/vendor/materials', roles: ['vendor'], activeRoutes: ['/vendor/materials'] },
      { label: 'Profile', icon: 'person-outline', route: '/vendor/profile', roles: ['vendor'], activeRoutes: ['/vendor/profile'] },
      { label: 'Reports', icon: 'bar-chart-outline', route: '/vendor/reports', roles: ['vendor'], activeRoutes: ['/vendor/reports'] },
      { label: 'Dashboard', icon: 'clipboard-outline', route: '/operator-quarry/dashboard', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/dashboard'] },
      { label: 'Weigh-In', icon: 'download-outline', route: '/operator-quarry/weigh-in', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/weigh-in'] },
      { label: 'Weigh-Out', icon: 'arrow-up-outline', route: '/operator-quarry/weigh-out', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/weigh-out'] },
      { label: 'History', icon: 'time-outline', route: '/operator-quarry/history', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/history'] },
      { label: 'Profile', icon: 'person-outline', route: '/operator-quarry/profile', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/profile'] },
      { label: 'Schedule', icon: 'calendar-outline', route: '/operator-site/schedule', roles: ['operator_site'], activeRoutes: ['/operator-site/schedule'] },
      { label: 'Weights', icon: 'scale-outline', route: '/operator-site/weights', roles: ['operator_site'], activeRoutes: ['/operator-site/weights'] },
      { label: 'History', icon: 'time-outline', route: '/operator-site/history', roles: ['operator_site'], activeRoutes: ['/operator-site/history'] },
      { label: 'Profile', icon: 'person-outline', route: '/operator-site/profile', roles: ['operator_site'], activeRoutes: ['/operator-site/profile'] },
      { label: 'Inspections', icon: 'clipboard-outline', route: '/inspector', roles: ['inspector'], activeRoutes: ['/inspector'], exactActive: true },
      { label: 'History', icon: 'time-outline', route: '/inspector/history', roles: ['inspector'], activeRoutes: ['/inspector/history'] },
      { label: 'Profile', icon: 'person-outline', route: '/inspector/profile', roles: ['inspector'], activeRoutes: ['/inspector/profile'] },
      { label: 'Dispense Fuel', icon: 'water-outline', route: '/operator-fuel/dispense', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/dispense'] },
      { label: 'History', icon: 'time-outline', route: '/operator-fuel/history', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/history'] },
      { label: 'Profile', icon: 'person-outline', route: '/operator-fuel/profile', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/profile'] },
      { label: 'Receiving', icon: 'cube-outline', route: '/store-account', roles: ['storeman'], activeRoutes: ['/store-account'], exactActive: true },
      { label: 'Inspection', icon: 'checkbox-outline', route: '/store-account/inspection', roles: ['storeman'], activeRoutes: ['/store-account/inspection'] },
      { label: 'History', icon: 'time-outline', route: '/store-account/history', roles: ['storeman'], activeRoutes: ['/store-account/history'] },
      { label: 'Profile', icon: 'person-outline', route: '/store-account/profile', roles: ['storeman'], activeRoutes: ['/store-account/profile'] },
      { label: 'Inventory', icon: 'layers-outline', route: '/store-account/inventory', roles: ['storeman'], activeRoutes: ['/store-account/inventory'] },
    ],
  },
  {
    title: 'General',
    icon: 'compass-outline',
    items: [
      { label: 'Fuel Records', icon: 'water-outline', route: '/screens/fuel', roles: ['vendor'], activeRoutes: ['/screens/fuel'] },
      { label: 'Issues', icon: 'chatbubble-ellipses-outline', route: '/screens/issues', roles: ['operator_quarry', 'operator_site', 'vendor', 'inspector', 'storeman'], activeRoutes: ['/screens/issues'] },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  drawerMode?: boolean;
  onNavigate?: (route: string) => void;
}

export default function Sidebar({ drawerMode = false, onNavigate, collapsed = false }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const colors = useTheme();
  const { isDark } = useThemeMode();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [loggingOut, setLoggingOut] = useState(false);
  const resolvedIssuesCount = useResolvedIssuesCount();

  // In drawer mode on mobile web, the close button is handled by WebLayout;
  // we still need to save vertical space by omitting the main container border style
  const containerStyle = drawerMode
    ? [styles.containerDrawer, { width: '100%', backgroundColor: colors.surface }]
    : [styles.container, { width: collapsed ? 76 : Math.min(260, width * 0.25), backgroundColor: colors.surface, borderRightColor: colors.border }];

  const rawRole = (user?.role || '') as UserRole;
  const role = normalizeRole(user?.role);

  const navSections = useMemo(() => {
    if (isManagementRole(role)) return getManagementNavigation(role);
    const source = ROLE_SECTIONS;
    return source
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.roles?.includes(rawRole)),
      }))
      .filter((section) => section.items.length > 0);
  }, [rawRole, role]);

  const isActive = (item: NavItem): boolean => {
    if (item.activeRoutes) {
      return item.activeRoutes.some((r) => item.exactActive ? pathname === r : pathname === r || pathname.startsWith(r + '/'));
    }
    return item.route ? pathname.startsWith(item.route) : false;
  };

  // The dark palette's primary colour is intentionally deep for surfaces, so
  // it is not legible as navigation text on an active primary-light item.
  // Use the theme's high-contrast text colours for sidebar labels and icons.
  const activeNavColor = isDark ? colors.text : colors.primary;
  const inactiveNavColor = isDark ? colors.textSecondary : colors.textMuted;
  const sectionLabelColor = isDark ? colors.textMuted : colors.textTertiary;

  const handleNav = (route?: string) => {
    if (!route) return;
    // @ts-ignore
    router.push(route);
    if (drawerMode && onNavigate) {
      onNavigate(route);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = await showConfirm('Logout', 'Are you sure you want to logout?');
      if (!confirmed) return;
      setLoggingOut(true);
      await logout();
      setLoggingOut(false);
      router.replace('/(auth)/login' as any);
    } else {
      setLoggingOut(true);
      await logout();
      setLoggingOut(false);
      router.replace('/(auth)/login' as any);
    }
  };

  return (
    <View style={containerStyle}>
      {/* Logo */}
      <TouchableOpacity
        style={[styles.logoSection, { borderBottomColor: colors.border }, collapsed && { paddingHorizontal: 18 }]}
        onPress={() => {
          if (isManagementRole(role)) {
            handleNav(managementHomeRoute(role));
            return;
          }
          switch (rawRole) {
            case 'vendor':
              handleNav('/vendor/dashboard');
              break;
            case 'operator_quarry':
              handleNav('/operator-quarry/dashboard');
              break;
            case 'operator_site':
              handleNav('/operator-site/schedule');
              break;
            case 'operator_fuel':
              handleNav('/operator-fuel/dispense');
              break;
            case 'inspector':
              handleNav('/inspector');
              break;
            case 'storeman':
              handleNav('/store-account');
              break;
            default:
              handleNav('/(auth)/login');
          }
        }}
      >
        {Platform.OS === 'web' ? <Image source={require('../assets/icon.png')} accessibilityLabel="Truck Sphere app icon" resizeMode="contain" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} /> : <View style={[styles.logoMark, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.logoText, { color: colors.primaryText }]}>TS</Text>
        </View>}
        {!collapsed && <Text style={[styles.brandName, { color: colors.text }]}>
          TRUCK<Text style={[styles.brandAccent, { color: colors.primaryText }]}>SPHERE</Text>
        </Text>}
      </TouchableOpacity>

      {/* User Info */}
      {Platform.OS !== 'web' && <View style={[styles.userSection, { borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.background }]}>
            {(user?.displayName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
            {user?.displayName || 'User'}
          </Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={10} color={colors.primaryText} />
            <Text style={[styles.roleText, { color: colors.primaryText }]}>{getRoleLabel(user?.role || '')}</Text>
          </View>
        </View>
      </View>}

      {/* Navigation */}
      <ScrollView style={styles.navScroll} contentContainerStyle={styles.navContent}>
        {navSections.map((section, sectionIndex) => (
          <View key={section.title}>
            {sectionIndex > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            {!collapsed && <View style={styles.navSectionHeader}>
              <Ionicons name={section.icon} size={13} color={sectionLabelColor} />
              <Text style={[styles.navSectionTitle, { color: sectionLabelColor }]}>{section.title}</Text>
            </View>}
            {section.items.map((item) => {
              const active = isActive(item);
              const disabled = !item.route;
              const navigationItem = (
              <TouchableOpacity
                key={(item.route || section.title) + item.label}
                style={StyleSheet.flatten<ViewStyle>([
                  styles.navItem,
                  active && [styles.navItemActive, { backgroundColor: colors.primaryLight }],
                  disabled && styles.navItemDisabled,
                  collapsed && { justifyContent: 'center', paddingHorizontal: 0, marginHorizontal: 8, minHeight: 44 },
                ])}
                onPress={() => Platform.OS === 'web' ? (drawerMode && item.route && onNavigate?.(item.route)) : handleNav(item.route)}
                disabled={disabled}
                accessibilityRole={item.route ? 'link' : 'button'}
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active, disabled }}
              >
                {item.route === '/warehouse' ? <MaterialCommunityIcons name="warehouse" size={20} color={active ? activeNavColor : inactiveNavColor} /> : <Ionicons name={item.icon} size={20} color={active ? activeNavColor : inactiveNavColor} />}
                {!collapsed && <Text
                  style={[
                    styles.navItemText,
                    active && styles.navItemTextActive,
                    { color: active ? activeNavColor : inactiveNavColor },
                    disabled && [styles.navItemTextDisabled, { color: colors.textTertiary }],
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>}
                {item.label === 'Issues' && resolvedIssuesCount > 0 && (
                  <View style={[styles.resolvedIssueBadge, { backgroundColor: colors.success }]}>
                    <Text style={[styles.resolvedIssueBadgeText, { color: colors.background }]}>{resolvedIssuesCount}</Text>
                  </View>
                )}
                {disabled && <View style={[styles.plannedDot, { backgroundColor: colors.textTertiary }]} />}
              </TouchableOpacity>
              );
              return Platform.OS === 'web' && item.route ? <Link key={item.route + item.label} href={item.route as any} asChild>{navigationItem}</Link> : navigationItem;
            })}
          </View>
        ))}
        <ThemeToggle compact={collapsed} />
        {/* Keep logout in the scrollable navigation so it remains reachable on shorter screens. */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: `${colors.danger}16`, borderColor: `${colors.danger}45` }, loggingOut && { opacity: 0.6 }]}
          onPress={handleLogout}
          disabled={loggingOut}
          accessibilityLabel="Log out"
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              {!collapsed && <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>}
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// Colours are applied inline from the active theme. Keeping them out of this
// module-scope stylesheet avoids referencing theme state that does not exist
// here and keeps every label legible in both light and dark mode.
const styles = StyleSheet.create({
    container: {
      height: '100%',
      flexDirection: 'column',
      borderRightWidth: 1,
      borderRightColor: 'transparent',
    } as any,
    containerDrawer: {
      height: '100%',
      flexDirection: 'column',
    } as any,
    logoSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Gap,
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: 'transparent',
    },
    logoMark: {
      width: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    logoText: {
      fontSize: 16,
      fontWeight: '900',
    },
    brandName: {
      fontSize: 16,
      fontWeight: '900',
    },
    brandAccent: {},
    userSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Gap,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'transparent',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '800',
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 14,
      fontWeight: '700',
    },
    roleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Gap, marginTop: Spacing.xs,
    },
    roleText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    navScroll: {
      flex: 1,
    },
    navContent: {
      paddingVertical: 12,
      paddingBottom: 24,
    },
    navSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Gap,
      paddingHorizontal: 20,
      paddingTop: 8, marginBottom: Spacing.xs,
    },
    navSectionTitle: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Gap,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 8,
      marginHorizontal: 8, marginBottom: Spacing.xs,
    },
    navItemActive: {
      backgroundColor: 'transparent',
    },
    navItemDisabled: {
      opacity: 0.52,
    },
    navItemText: {
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    navItemTextActive: {
      fontWeight: '700',
    },
    navItemTextDisabled: {},
    plannedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'transparent',
    },
    resolvedIssueBadge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    resolvedIssueBadgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    divider: {
      height: 1,
      backgroundColor: 'transparent',
      marginHorizontal: 16, marginVertical: Spacing.xs,
    },
    logoutBtn: {
      marginTop: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Gap,
      paddingVertical: 14,
      marginHorizontal: 16, marginBottom: Spacing.xs,
      borderRadius: 8,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    logoutText: {
      fontSize: 14,
      fontWeight: '800',
    },
  });
