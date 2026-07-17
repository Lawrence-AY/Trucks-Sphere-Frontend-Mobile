import React, { useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import { getRoleLabel } from '../utils/helpers';
import { showConfirm } from '../utils/webAlert';
import type { UserRole } from '../store/types';

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  roles: UserRole[];
  activeRoutes?: string[];
};

type NavSection = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: NavItem[];
};

const MANAGEMENT_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    icon: 'apps-outline',
    items: [
      { label: 'Dashboard', icon: 'apps-outline', route: '/management/dashboard', roles: ['admin', 'management'], activeRoutes: ['/management/dashboard'] },
      { label: 'Active Jobs', icon: 'layers-outline', route: '/management/active', roles: ['admin', 'management'], activeRoutes: ['/management/active'] },
      { label: 'Orders', icon: 'document-text-outline', route: '/management/orders', roles: ['admin', 'management'], activeRoutes: ['/management/orders'] },
      { label: 'Materials', icon: 'cube-outline', route: '/management/materials', roles: ['admin', 'management'], activeRoutes: ['/management/materials'] },
      { label: 'Vendors', icon: 'business-outline', route: '/management/vendors', roles: ['admin', 'management'], activeRoutes: ['/management/vendors'] },
      { label: 'Drivers', icon: 'people-outline', route: '/management/drivers', roles: ['admin', 'management'], activeRoutes: ['/management/drivers'] },
      { label: 'Trucks', icon: 'car-outline', route: '/management/trucks', roles: ['admin', 'management'], activeRoutes: ['/management/trucks'] },
    ],
  },
  {
    title: 'Operations',
    icon: 'radio-outline',
    items: [
     // { label: 'Dispatch', icon: 'git-branch-outline', route: '/management/dispatch', roles: ['admin', 'management'], activeRoutes: ['/management/dispatch'] },
      { label: 'Fuel Records', icon: 'water-outline', route: '/management/fuel', roles: ['admin', 'management'], activeRoutes: ['/management/fuel'] },
    //  { label: 'Quarries', icon: 'business-outline', route: '/management/quarries', roles: ['admin', 'management'], activeRoutes: ['/management/quarries'] },
    ],
  },
  {
    title: 'Intelligence',
    icon: 'analytics-outline',
    items: [
      { label: 'Reports', icon: 'bar-chart-outline', route: '/management/reports', roles: ['admin', 'management'], activeRoutes: ['/management/reports'] },
      { label: 'Issues', icon: 'chatbubble-ellipses-outline', route: '/screens/issues', roles: ['admin', 'management'], activeRoutes: ['/screens/issues'] },
    //  { label: 'History', icon: 'time-outline', route: '/management/active', roles: ['admin', 'management'], activeRoutes: ['/management/active'] },
    ],
  },
  {
    title: 'Administration',
    icon: 'settings-outline',
    items: [
      { label: 'Users', icon: 'person-add-outline', route: '/management/users', roles: ['admin', 'management'], activeRoutes: ['/management/users'] },
      { label: 'Master Data', icon: 'server-outline', route: '/management/master-data', roles: ['admin', 'management'], activeRoutes: ['/management/master-data'] },
      { label: 'Profile', icon: 'person-outline', route: '/management/profile', roles: ['admin', 'management'], activeRoutes: ['/management/profile'] },
    ],
  },
];

const ROLE_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    icon: 'apps-outline',
    items: [
      { label: 'Dashboard', icon: 'home-outline', route: '/vendor/dashboard', roles: ['vendor'], activeRoutes: ['/vendor/dashboard'] },
      { label: 'Trips', icon: 'layers-outline', route: '/vendor/trips', roles: ['vendor'], activeRoutes: ['/vendor/trips'] },
      { label: 'Drivers', icon: 'people-outline', route: '/vendor/drivers', roles: ['vendor'], activeRoutes: ['/vendor/drivers'] },
      { label: 'Trucks', icon: 'car-outline', route: '/vendor/trucks', roles: ['vendor'], activeRoutes: ['/vendor/trucks'] },
      { label: 'Purchase Orders', icon: 'document-text-outline', route: '/vendor/orders', roles: ['vendor'], activeRoutes: ['/vendor/orders'] },
      { label: 'Materials', icon: 'cube-outline', route: '/vendor/materials', roles: ['vendor'], activeRoutes: ['/vendor/materials'] },
      { label: 'Profile', icon: 'person-outline', route: '/vendor/profile', roles: ['vendor'], activeRoutes: ['/vendor/profile'] },
      { label: 'Settings', icon: 'settings-outline', route: '/vendor/settings', roles: ['vendor'], activeRoutes: ['/vendor/settings'] },
      { label: 'Dashboard', icon: 'home-outline', route: '/operator-quarry/dashboard', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/dashboard'] },
      { label: 'Weigh-In', icon: 'download-outline', route: '/operator-quarry/weigh-in', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/weigh-in'] },
      { label: 'Weigh-Out', icon: 'arrow-up-circle-outline', route: '/operator-quarry/weigh-out', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/weigh-out'] },
      { label: 'History', icon: 'time-outline', route: '/operator-quarry/history', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/history'] },
      { label: 'Profile', icon: 'person-outline', route: '/operator-quarry/profile', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/profile'] },
      { label: 'Settings', icon: 'settings-outline', route: '/operator-quarry/settings', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/settings'] },
      { label: 'Schedule', icon: 'calendar-outline', route: '/operator-site/schedule', roles: ['operator_site'], activeRoutes: ['/operator-site/schedule'] },
      { label: 'Weights', icon: 'scale-outline', route: '/operator-site/weights', roles: ['operator_site'], activeRoutes: ['/operator-site/weights'] },
      { label: 'History', icon: 'time-outline', route: '/operator-site/history', roles: ['operator_site'], activeRoutes: ['/operator-site/history'] },
      { label: 'Profile', icon: 'person-outline', route: '/operator-site/profile', roles: ['operator_site'], activeRoutes: ['/operator-site/profile'] },
      { label: 'Settings', icon: 'settings-outline', route: '/operator-site/settings', roles: ['operator_site'], activeRoutes: ['/operator-site/settings'] },
      { label: 'Dispense Fuel', icon: 'water-outline', route: '/operator-fuel/dispense', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/dispense'] },
      { label: 'History', icon: 'time-outline', route: '/operator-fuel/history', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/history'] },
      { label: 'Profile', icon: 'person-outline', route: '/operator-fuel/profile', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/profile'] },
    ],
  },
  {
    title: 'General',
    icon: 'compass-outline',
    items: [
      { label: 'Fuel Records', icon: 'water-outline', route: '/screens/fuel', roles: ['vendor'], activeRoutes: ['/screens/fuel'] },
      { label: 'Issues', icon: 'chatbubble-ellipses-outline', route: '/screens/issues', roles: ['operator_quarry', 'operator_site', 'vendor'], activeRoutes: ['/screens/issues'] },
      { label: 'Notifications', icon: 'notifications-outline', route: '/screens/notifications', roles: ['operator_quarry', 'operator_site', 'vendor', 'operator_fuel'], activeRoutes: ['/screens/notifications'] },
    ],
  },
];

interface SidebarProps {
  drawerMode?: boolean;
  onNavigate?: (route: string) => void;
}

export default function Sidebar({ drawerMode = false, onNavigate }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const colors = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [loggingOut, setLoggingOut] = useState(false);

  // In drawer mode on mobile web, the close button is handled by WebLayout;
  // we still need to save vertical space by omitting the main container border style
  const containerStyle = drawerMode
    ? [styles.containerDrawer, { width: '100%', backgroundColor: '#FFFFFF' }]
    : [styles.container, { width: Math.min(260, width * 0.25), backgroundColor: '#FFFFFF' }];

  const role = (user?.role || '') as UserRole;

  const navSections = useMemo(() => {
    const source = role === 'admin' || role === 'management' ? MANAGEMENT_SECTIONS : ROLE_SECTIONS;
    return source
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.roles.includes(role)),
      }))
      .filter((section) => section.items.length > 0);
  }, [role]);

  const isActive = (item: NavItem): boolean => {
    if (item.activeRoutes) {
      return item.activeRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
    }
    return item.route ? pathname.startsWith(item.route) : false;
  };

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
        style={styles.logoSection}
        onPress={() => {
          switch (role) {
            case 'management':
            case 'admin':
              handleNav('/management/dashboard');
              break;
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
            default:
              handleNav('/management/dashboard');
          }
        }}
      >
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>TS</Text>
        </View>
        <Text style={styles.brandName}>
          TRUCK<Text style={styles.brandAccent}>SPHERE</Text>
        </Text>
      </TouchableOpacity>

      {/* User Info */}
      <View style={styles.userSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.displayName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.displayName || 'User'}
          </Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={10} color="#1B2A4A" />
            <Text style={styles.roleText}>{getRoleLabel(role)}</Text>
          </View>
        </View>
      </View>

      {/* Navigation */}
      <ScrollView style={styles.navScroll} contentContainerStyle={styles.navContent}>
        {navSections.map((section, sectionIndex) => (
          <View key={section.title}>
            {sectionIndex > 0 && <View style={styles.divider} />}
            <View style={styles.navSectionHeader}>
              <Ionicons name={section.icon} size={13} color="#94A3B8" />
              <Text style={styles.navSectionTitle}>{section.title}</Text>
            </View>
            {section.items.map((item) => {
              const active = isActive(item);
              const disabled = !item.route;
              return (
              <TouchableOpacity
                key={(item.route || section.title) + item.label}
                style={[
                  styles.navItem,
                  active && styles.navItemActive,
                  disabled && styles.navItemDisabled,
                ]}
                onPress={() => handleNav(item.route)}
                disabled={disabled}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active ? '#1B2A4A' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.navItemText,
                    active && styles.navItemTextActive,
                    disabled && styles.navItemTextDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {disabled && <View style={styles.plannedDot} />}
              </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#EF4444" size="small" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  } as any,
  containerDrawer: {
    height: '100%',
    flexDirection: 'column',
  } as any,
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1B2A4A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  logoText: {
    color: '#1B2A4A',
    fontSize: 16,
    fontWeight: '900',
  },
  brandName: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '900',
  },
  brandAccent: {
    color: '#1B2A4A',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1B2A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1B2A4A',
    letterSpacing: 0.5,
  },
  navScroll: {
    flex: 1,
  },
  navContent: {
    paddingVertical: 12,
  },
  navSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 6,
  },
  navSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: '#1B2A4A12',
  },
  navItemDisabled: {
    opacity: 0.52,
  },
  navItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  navItemTextActive: {
    color: '#1B2A4A',
    fontWeight: '700',
  },
  navItemTextDisabled: {
    color: '#94A3B8',
  },
  plannedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
});