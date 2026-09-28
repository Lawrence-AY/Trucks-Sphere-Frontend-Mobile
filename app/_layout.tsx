import '../utils/webAlert';
import React, { useCallback, useEffect, useMemo } from 'react';
import { BackNavigation } from '../components/BackNavigation';
import { Stack, router } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useTheme, useThemeMode } from '../hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import Toast from 'react-native-toast-message';
import WebLayout from '../components/WebLayout';
import WebAlerts from '../components/WebAlerts';
import { setOnAuthExpired } from '../services/api';
import { ManagementRouteGuard } from '../components/management/ManagementRouteGuard';
import { CLEAR_HIDDEN_STACK_SCREEN_OPTIONS } from '../components/ui/stackScreenOptions';
import { PaperThemeProvider } from '../components/PaperThemeProvider';
import { canControlStatusBarAppearance } from '../utils/statusBar';

void ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { restoreSession, logout } = useAuthStore();
  const colors = useTheme();
  const { isDark } = useThemeMode();
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);
  const statusBarStyle: 'light' | 'dark' = isDark ? 'light' : 'dark';
  const systemStatusBarStyle: 'light-content' | 'dark-content' = statusBarStyle === 'light' ? 'light-content' : 'dark-content';
  const rootStackOptions = useMemo(() => ({
    ...CLEAR_HIDDEN_STACK_SCREEN_OPTIONS,
    contentStyle: { backgroundColor: colors.background },
    ...(canControlStatusBarAppearance ? {
      statusBarStyle,
      statusBarColor: colors.surface,
      statusBarTranslucent: false,
    } : {}),
  }), [colors.background, colors.surface, statusBarStyle]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    void hydrateTheme();
  }, [hydrateTheme]);

  // Wire up auto-logout on token expiry
  useEffect(() => {
    setOnAuthExpired(async () => {
      await logout();
      // Force redirect to login by replacing entire navigation stack
      router.replace('/(auth)/login' as any);
    });
    return () => setOnAuthExpired(() => {});
  }, [logout]);

  const handleRootLayout = useCallback(() => {
    void ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView
      onLayout={handleRootLayout}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <PaperThemeProvider>
        <BackNavigation />
        {canControlStatusBarAppearance ? (
          <StatusBar barStyle={systemStatusBarStyle} backgroundColor={colors.surface} translucent={false} />
        ) : null}
        <ManagementRouteGuard>
          <WebLayout>
            <Stack screenOptions={rootStackOptions}>
            <Stack.Screen name="index" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="(auth)" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="management" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="vendor" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="operator-site" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="operator-fuel" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="operator-quarry" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="warehouse" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="store-account" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="inspector" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="screens" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="session" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            <Stack.Screen name="track" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
            </Stack>
          </WebLayout>
        </ManagementRouteGuard>
        <Toast />
        <WebAlerts />
      </PaperThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
