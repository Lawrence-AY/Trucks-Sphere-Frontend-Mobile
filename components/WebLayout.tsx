import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import Sidebar from './Sidebar';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';

const AUTH_ROUTES = ['/(auth)', '/login', '/auth'];
const HIDE_SIDEBAR_ROUTES = ['/track'];

interface WebLayoutProps {
  children: React.ReactNode;
}

/**
 * WebLayout provides a responsive layout for web:
 * - Desktop (>= 768px): Fixed sidebar + scrollable content area
 * - Mobile web (< 768px): Top navbar with hamburger → slide-in drawer
 * - Native (iOS/Android): Pass-through (tabs handle navigation)
 * - Track & Auth routes: Pass-through (no sidebar/navbar)
 */
export default function WebLayout({ children }: WebLayoutProps) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const colors = useTheme();
  const isLoading = useAuthStore((state) => state.isLoading);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= 768;
  const isMobileWeb = isWeb && width < 768;

  const isAuthScreen = pathname && AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isSplashScreen = !pathname || pathname === '/';
  const isHideSidebarRoute = pathname && HIDE_SIDEBAR_ROUTES.some((route) => pathname.startsWith(route));

  const drawerWidth = Math.min(300, width * 0.82);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, overlayAnim]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -drawerWidth,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setDrawerOpen(false));
  }, [slideAnim, overlayAnim, drawerWidth]);

  const handleSidebarNav = useCallback(
    (_route: string) => {
      closeDrawer();
    },
    [closeDrawer],
  );

  const navigationDrawer = drawerOpen ? (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.drawerOverlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>
      <Animated.View
        style={[
          styles.drawerPanel,
          {
            width: drawerWidth,
            backgroundColor: colors.surface,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={[styles.drawerHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={closeDrawer} style={[styles.drawerCloseBtn, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Sidebar drawerMode onNavigate={handleSidebarNav} />
      </Animated.View>
    </View>
  ) : null;

  // ── Desktop Web: Fixed Sidebar ──
  if (isDesktopWeb) {
    if (isAuthScreen || isSplashScreen || isHideSidebarRoute || isLoading) {
      return <>{children}</>;
    }
    return (
      <View style={[styles.desktopContainer, { backgroundColor: colors.background }]}>
        <Sidebar />
        <View style={[styles.desktopContent, { backgroundColor: colors.background }]}>
          {children}
        </View>
        {navigationDrawer}
      </View>
    );
  }

  // ── Mobile Web: Top Navbar + Drawer ──
  if (isMobileWeb) {
    if (isAuthScreen || isSplashScreen || isHideSidebarRoute || isLoading) {
      return <>{children}</>;
    }
    return (
      <View style={[styles.mobileRoot, { backgroundColor: colors.background }]}>
        {/* Top Navbar */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={openDrawer}
            style={[styles.hamburgerBtn, { backgroundColor: colors.inputBg }]}
            accessibilityLabel="Open navigation menu"
            accessibilityRole="button"
          >
            <Ionicons name="menu-outline" size={26} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.topBarSpacer} />
          <TouchableOpacity
            onPress={() => {
              // @ts-ignore
              router.push('/screens/notifications');
            }}
            style={[styles.topBarNotifBtn, { backgroundColor: colors.inputBg }]}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={23} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Page Content */}
        <View style={styles.mobileContent}>{children}</View>

        {navigationDrawer}
      </View>
    );
  }

  // ── Native Mobile: Pass-through ──
  return <>{children}</>;
}

const styles = StyleSheet.create({
  /* ── Desktop ── */
  desktopContainer: {
    flex: 1,
    flexDirection: 'row' as const,
  } as any,
  desktopContent: {
    flex: 1,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  } as any,
  /* ── Mobile Web ── */
  mobileRoot: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    zIndex: 10,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 0,
      },
    }),
  },
  hamburgerBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  topBarLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  logoMarkSmall: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1B2A4A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  logoTextSmall: {
    color: '#1B2A4A',
    fontSize: 13,
    fontWeight: '900',
  },
  brandSmall: {
    fontSize: 14,
    fontWeight: '900',
  },
  topBarSpacer: {
    flex: 1,
  },
  mobileContent: {
    flex: 1,
    overflow: 'hidden' as const,
  },

  /* ── Drawer ── */
  drawerOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  drawerCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarNotifBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
});
