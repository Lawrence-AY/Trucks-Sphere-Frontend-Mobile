import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Sidebar from './Sidebar';

interface WebLayoutProps {
  children: React.ReactNode;
}

export default function WebLayout({ children }: WebLayoutProps) {
  const { width } = useWindowDimensions();

  // Only apply sidebar layout on web with sufficient width
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  if (!isDesktopWeb) {
    // On mobile/narrow screens, just render children (the existing tabs/stack layout)
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