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
      <Stack.Screen name="receipt-note" options={{ title: 'Receipt Note' }} />
      <Stack.Screen name="weigh-receipt" options={{ title: 'Weighment Receipt' }} />
      <Stack.Screen name="delivery-note" options={{ title: 'Delivery Note' }} />
      <Stack.Screen name="job-details" options={{ title: 'Job Details' }} />
      <Stack.Screen name="material-details" options={{ title: 'Material Details' }} />
      <Stack.Screen name="purchase-order" options={{ title: 'Purchase Order' }} />
      <Stack.Screen name="vendor-details" options={{ title: 'Vendor Details' }} />
      <Stack.Screen name="driver-history" options={{ headerShown: false }} />
      <Stack.Screen name="truck-history" options={{ title: 'Truck History' }} />
      <Stack.Screen name="vendor-detail" options={{ title: 'Vendor Details' }} />
      <Stack.Screen name="fuel" options={{ title: 'Fuel Records' }} />
    </Stack>
  );
}
