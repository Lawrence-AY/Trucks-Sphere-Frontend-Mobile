import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import Sidebar from './Sidebar';

const AUTH_ROUTES = ['/(auth)', '/login', '/auth'];

interface WebLayoutProps {
  children: React.ReactNode;
}

export default function WebLayout({ children }: WebLayoutProps) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();

  // Only apply sidebar layout on web with sufficient width
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  // Hide sidebar on auth screens
  const isAuthScreen = pathname && AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (!isDesktopWeb || isAuthScreen) {
    // On mobile/narrow screens or auth screens, just render children (the existing tabs/stack layout)
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <Sidebar />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row' as const,
    backgroundColor: '#F1F5F9',
  } as any,
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden' as const,
  } as any,
});