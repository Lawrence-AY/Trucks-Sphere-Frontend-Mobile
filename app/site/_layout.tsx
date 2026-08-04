import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import HamburgerMenu from '../../components/HamburgerMenu';
import { useClearStackScreenOptions } from '../../components/ui/stackScreenOptions';

export default function SiteLayout() {
  const screenOptions = useClearStackScreenOptions(
    Platform.OS === 'web' ? undefined : () => <HamburgerMenu />,
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Deliveries' }} />
    </Stack>
  );
}
