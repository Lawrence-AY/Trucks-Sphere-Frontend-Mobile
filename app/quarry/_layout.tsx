import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import HamburgerMenu from '../../components/HamburgerMenu';

export default function QuarryLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Quarry Queue' }} />
      <Stack.Screen name="weigh-in" options={{ title: 'Weigh In' }} />
      <Stack.Screen name="weigh-out" options={{ title: 'Weigh Out' }} />
    </Stack>
  );
}
