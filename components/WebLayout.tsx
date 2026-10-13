import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import Sidebar from './Sidebar';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '../hooks/useTheme';
import { Gap } from '../constants/theme';
import { WorkspaceHeader } from './WorkspaceHeader';

const AUTH_ROUTES = ['/(auth)', '/login', '/auth'];
const HIDE_SIDEBAR_ROUTES = ['/track', '/session', '/security'];
const DESKTOP_BREAKPOINT = 1024;

interface WebLayoutProps {
  children: React.ReactNode;
}

/**
 * WebLayout provides a responsive layout for web:
 * - Desktop (>= 1024px): Fixed sidebar + full-width workspace
 * - Mobile web (< 1024px): Top navbar with hamburger → slide-in drawer
 * - Native (iOS/Android): Pass-through (tabs handle navigation)
 * - Track & Auth routes: Pass-through (no sidebar/navbar)
 */
export default function WebLayout({ children }: WebLayoutProps) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const colors = useTheme();
  const isLoading = useAuthStore((state) => state.isLoading);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const isWeb = Platform.OS === 'web';
  // A sidebar at tablet widths leaves too little room for operational forms
  // and data cards, so tablet web uses the compact drawer layout.
  const isDesktopWeb = isWeb && width >= DESKTOP_BREAKPOINT;
  const isMobileWeb = isWeb && width < DESKTOP_BREAKPOINT;

  const isAuthScreen = pathname && AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isSplashScreen = !pathname || pathname === '/';
  const isHideSidebarRoute = pathname && HIDE_SIDEBAR_ROUTES.some((route) => pathname.startsWith(route));

  const drawerWidth = Math.min(320, width * 0.82);

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
      <Animated.View style={[styles.drawerOverlay, { backgroundColor: colors.overlay, opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>
      <Animated.View
        style={[
          styles.drawerPanel,
          {
            width: drawerWidth,
            backgroundColor: colors.surface,
            shadowColor: colors.shadow,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={[styles.drawerHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={closeDrawer} style={[styles.drawerCloseBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Sidebar drawerMode onNavigate={handleSidebarNav} />
      </Animated.View>
    </View>
  ) : null;

  // ── Desktop Web: Fixed Sidebar + Centred Content Column ──
  if (isDesktopWeb) {
    if (isAuthScreen || isSplashScreen || isHideSidebarRoute || isLoading) {
      return <>{children}</>;
    }
    return (
      <View style={[styles.desktopContainer, { backgroundColor: colors.background }]}>
        <Sidebar collapsed={sidebarCollapsed} />
        <View style={[styles.desktopContent, { backgroundColor: colors.background }]}>
          <WorkspaceHeader collapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(value => !value)} />
          <View style={styles.desktopPage}>{children}</View>
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
            style={[styles.hamburgerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="Open navigation menu"
            accessibilityRole="button"
          >
            <Ionicons name="menu-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.topBarSpacer} />
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

// Colours are supplied inline from the active theme so every surface, border
// and label follows the light/dark palette.
const styles = StyleSheet.create({
    /* ── Desktop ── */
    desktopContainer: {
      flex: 1,
      flexDirection: 'row' as const,
      gap: 0,
    },
    desktopContent: {
      flex: 1,
      minWidth: 0,
      overflow: 'hidden' as const,
      position: 'relative' as const,
      gap: 0,
    } as any,
    desktopPage: {
      flex: 1,
      width: '100%',
      alignSelf: 'center',
      gap: Gap,
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
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarSpacer: {
      flex: 1,
    },
    mobileContent: {
      flex: 1,
      minWidth: 0,
      width: '100%',
      overflow: 'hidden' as const,
      gap: Gap,
    } as any,

    /* ── Drawer ── */
    drawerOverlay: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
    } as any,
    drawerPanel: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 101,
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
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
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
