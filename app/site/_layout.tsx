import { Stack } from 'expo-router';
import React from 'react';
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
        headerRight: () => <HamburgerMenu />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Deliveries' }} />
      <Stack.Screen name="receive" options={{ title: 'Receive Delivery' }} />
    </Stack>
  );
}
