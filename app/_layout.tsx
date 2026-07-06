import React, { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/theme';
import Toast from 'react-native-toast-message';
import WebLayout from '../components/WebLayout';

void ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { restoreSession } = useAuthStore();

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const handleRootLayout = useCallback(() => {
    void ExpoSplashScreen.hideAsync().catch((error) => {
      console.warn('Failed to hide native splash screen:', error);
    });
  }, []);

  return (
    <GestureHandlerRootView
      onLayout={handleRootLayout}
      style={[styles.container, { backgroundColor: Colors.light.background }]}
    >
      <StatusBar style="dark" />
      <WebLayout>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="management" options={{ headerShown: false }} />
          <Stack.Screen name="vendor" options={{ headerShown: false }} />
          <Stack.Screen name="operator-site" options={{ headerShown: false }} />
          <Stack.Screen name="operator-fuel" options={{ headerShown: false }} />
          <Stack.Screen name="operator-quarry" options={{ headerShown: false }} />
          <Stack.Screen name="quarry" options={{ headerShown: false }} />
          <Stack.Screen name="site" options={{ headerShown: false }} />
          <Stack.Screen name="screens" options={{ headerShown: false }} />
        </Stack>
      </WebLayout>
      <Toast />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
