import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import HamburgerMenu from '../../components/HamburgerMenu';

export default function SiteLayout() {
  const colors = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
        headerRight: Platform.OS === 'web' ? undefined : () => <HamburgerMenu />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Deliveries' }} />
    </Stack>
  );
}
