import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import HamburgerMenu from '../../components/HamburgerMenu';

export default function ScreensLayout() {
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
      <Stack.Screen name="weigh-receipt" options={{ title: 'Weighment Receipt' }} />
      <Stack.Screen name="delivery-note" options={{ title: 'Delivery Note' }} />
      <Stack.Screen name="purchase-order" options={{ title: 'Purchase Order' }} />
      <Stack.Screen name="driver-history" options={{ title: 'Driver History' }} />
      <Stack.Screen name="truck-history" options={{ title: 'Truck History' }} />
    </Stack>
  );
}
