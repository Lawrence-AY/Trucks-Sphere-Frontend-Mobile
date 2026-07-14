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
  route: string;
  roles: UserRole[];
  activeRoutes?: string[];
};

const NAV_ITEMS: NavItem[] = [
  // Management / Admin
  { label: 'Dashboard', icon: 'home-outline', route: '/management/dashboard', roles: ['admin', 'management'], activeRoutes: ['/management/dashboard'] },
  { label: 'Active Orders', icon: 'layers-outline', route: '/management/active', roles: ['admin', 'management'], activeRoutes: ['/management/active'] },
  { label: 'Materials', icon: 'cube-outline', route: '/management/materials', roles: ['admin', 'management'], activeRoutes: ['/management/materials'] },
  { label: 'Drivers', icon: 'people-outline', route: '/management/drivers', roles: ['admin', 'management'], activeRoutes: ['/management/drivers'] },
  { label: 'Orders', icon: 'document-text-outline', route: '/management/orders', roles: ['admin', 'management'], activeRoutes: ['/management/orders'] },
  { label: 'Trucks', icon: 'car-outline', route: '/management/trucks', roles: ['admin', 'management'], activeRoutes: ['/management/trucks'] },
  { label: 'Profile', icon: 'person-outline', route: '/management/profile', roles: ['admin', 'management'], activeRoutes: ['/management/profile'] },
  { label: 'Settings', icon: 'settings-outline', route: '/management/settings', roles: ['admin', 'management'], activeRoutes: ['/management/settings'] },
  // Vendor
  { label: 'Dashboard', icon: 'home-outline', route: '/vendor/dashboard', roles: ['vendor'], activeRoutes: ['/vendor/dashboard'] },
  { label: 'Trips', icon: 'layers-outline', route: '/vendor/trips', roles: ['vendor'], activeRoutes: ['/vendor/trips'] },
  { label: 'Drivers', icon: 'people-outline', route: '/vendor/drivers', roles: ['vendor'], activeRoutes: ['/vendor/drivers'] },
  { label: 'Trucks', icon: 'car-outline', route: '/vendor/trucks', roles: ['vendor'], activeRoutes: ['/vendor/trucks'] },
  { label: 'Purchase Orders', icon: 'document-text-outline', route: '/vendor/orders', roles: ['vendor'], activeRoutes: ['/vendor/orders'] },
  { label: 'Materials', icon: 'cube-outline', route: '/vendor/materials', roles: ['vendor'], activeRoutes: ['/vendor/materials'] },
  { label: 'Profile', icon: 'person-outline', route: '/vendor/profile', roles: ['vendor'], activeRoutes: ['/vendor/profile'] },
  { label: 'Settings', icon: 'settings-outline', route: '/vendor/settings', roles: ['vendor'], activeRoutes: ['/vendor/settings'] },
  // Operator Quarry
  { label: 'Dashboard', icon: 'home-outline', route: '/operator-quarry/dashboard', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/dashboard'] },
  { label: 'Weigh-In', icon: 'download-outline', route: '/operator-quarry/weigh-in', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/weigh-in'] },
  { label: 'Weigh-Out', icon: 'arrow-up-circle-outline', route: '/operator-quarry/weigh-out', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/weigh-out'] },
  { label: 'History', icon: 'time-outline', route: '/operator-quarry/history', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/history'] },
  { label: 'Materials', icon: 'cube-outline', route: '/operator-quarry/materials', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/materials'] },
  { label: 'Profile', icon: 'person-outline', route: '/operator-quarry/profile', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/profile'] },
  { label: 'Settings', icon: 'settings-outline', route: '/operator-quarry/settings', roles: ['operator_quarry'], activeRoutes: ['/operator-quarry/settings'] },
  // Operator Site
  { label: 'Dashboard', icon: 'home-outline', route: '/operator-site/dashboard', roles: ['operator_site'], activeRoutes: ['/operator-site/dashboard'] },
  { label: 'Receive', icon: 'checkmark-circle-outline', route: '/operator-site/receive', roles: ['operator_site'], activeRoutes: ['/operator-site/receive'] },
  { label: 'Weights', icon: 'scale-outline', route: '/operator-site/weights', roles: ['operator_site'], activeRoutes: ['/operator-site/weights'] },
  { label: 'History', icon: 'time-outline', route: '/operator-site/history', roles: ['operator_site'], activeRoutes: ['/operator-site/history'] },
  { label: 'Materials', icon: 'cube-outline', route: '/operator-site/materials', roles: ['operator_site'], activeRoutes: ['/operator-site/materials'] },
  { label: 'Profile', icon: 'person-outline', route: '/operator-site/profile', roles: ['operator_site'], activeRoutes: ['/operator-site/profile'] },
  { label: 'Settings', icon: 'settings-outline', route: '/operator-site/settings', roles: ['operator_site'], activeRoutes: ['/operator-site/settings'] },
  // Operator Fuel
  { label: 'Dispense Fuel', icon: 'water-outline', route: '/operator-fuel/dispense', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/dispense'] },
  { label: 'History', icon: 'time-outline', route: '/operator-fuel/history', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/history'] },
  { label: 'Profile', icon: 'person-outline', route: '/operator-fuel/profile', roles: ['operator_fuel'], activeRoutes: ['/operator-fuel/profile'] },
];

const SHARED_ITEMS: NavItem[] = [
  { label: 'Fuel Records', icon: 'water-outline', route: '/screens/fuel', roles: ['admin', 'management', 'vendor'], activeRoutes: ['/screens/fuel'] },
  { label: 'Issues', icon: 'chatbubble-ellipses-outline', route: '/screens/issues', roles: ['admin', 'management', 'operator_quarry', 'operator_site', 'vendor'], activeRoutes: ['/screens/issues'] },
  { label: 'Vendors', icon: 'business-outline', route: '/screens/vendor-details', roles: ['admin', 'management'], activeRoutes: ['/screens/vendor-details'] },
  { label: 'Notifications', icon: 'notifications-outline', route: '/screens/notifications', roles: ['admin', 'management', 'operator_quarry', 'operator_site', 'vendor', 'operator_fuel'], activeRoutes: ['/screens/notifications'] },
  { label: 'Reports & Exports', icon: 'bar-chart-outline', route: '/management/reports', roles: ['admin', 'management'], activeRoutes: ['/management/reports'] },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const colors = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [loggingOut, setLoggingOut] = useState(false);

  const role = (user?.role || '') as UserRole;

  const roleNav = useMemo(() => {
    return NAV_ITEMS.filter((item) => item.roles.includes(role));
  }, [role]);

  const sharedNav = useMemo(() => {
    return SHARED_ITEMS.filter((item) => item.roles.includes(role));
  }, [role]);

  const isActive = (item: NavItem): boolean => {
    if (item.activeRoutes) {
      return item.activeRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
    }
    return pathname.startsWith(item.route);
  };

  const handleNav = (route: string) => {
    // @ts-ignore
    router.push(route);
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

  const sidebarWidth = Math.min(260, width * 0.25);

  return (
    <View style={[styles.container, { width: sidebarWidth, backgroundColor: '#FFFFFF' }]}>
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
              handleNav('/operator-site/dashboard');
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
        {/* Role-specific nav */}
        <Text style={styles.navSectionTitle}>MAIN</Text>
        {roleNav.map((item) => (
          <TouchableOpacity
            key={item.route + item.label}
            style={[
              styles.navItem,
              isActive(item) && styles.navItemActive,
            ]}
            onPress={() => handleNav(item.route)}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={isActive(item) ? '#1B2A4A' : '#94A3B8'}
            />
            <Text
              style={[
                styles.navItemText,
                isActive(item) && styles.navItemTextActive,
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Shared items */}
        {sharedNav.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.navSectionTitle}>GENERAL</Text>
            {sharedNav.map((item) => (
              <TouchableOpacity
                key={item.route + item.label}
                style={[
                  styles.navItem,
                  isActive(item) && styles.navItemActive,
                ]}
                onPress={() => handleNav(item.route)}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive(item) ? '#1B2A4A' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.navItemText,
                    isActive(item) && styles.navItemTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
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
  navSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingHorizontal: 20,
    paddingTop: 8,
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