import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import HamburgerMenu from '../../components/HamburgerMenu';
import { useClearStackScreenOptions } from '../../components/ui/stackScreenOptions';

export default function QuarryLayout() {
  const screenOptions = useClearStackScreenOptions(
    Platform.OS === 'web' ? undefined : () => <HamburgerMenu />,
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Quarry Queue' }} />
      <Stack.Screen name="weigh-in" options={{ title: 'Weigh In' }} />
      <Stack.Screen name="weigh-out" options={{ title: 'Weigh Out' }} />
    </Stack>
  );
}
