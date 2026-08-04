import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import HamburgerMenu from '../../components/HamburgerMenu';
import { CLEAR_HIDDEN_STACK_SCREEN_OPTIONS, useClearStackScreenOptions } from '../../components/ui/stackScreenOptions';

export default function ScreensLayout() {
  const screenOptions = useClearStackScreenOptions(
    Platform.OS === 'web' ? undefined : () => <HamburgerMenu />,
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="receipt-note" options={{ title: 'Receipt Note' }} />
      <Stack.Screen name="weigh-receipt" options={{ title: 'Weighment Receipt' }} />
      <Stack.Screen name="delivery-note" options={{ title: 'Delivery Note' }} />
      <Stack.Screen name="job-details" options={{ title: 'Job Details' }} />
      <Stack.Screen name="material-details" options={{ title: 'Material Details' }} />
      <Stack.Screen name="purchase-order" options={{ title: 'Purchase Order' }} />
      <Stack.Screen name="vendor-details" options={{ title: 'Vendor Details' }} />
      <Stack.Screen name="driver-history" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
      <Stack.Screen name="truck-history" options={{ title: 'Truck History' }} />
      <Stack.Screen name="vendor-detail" options={{ title: 'Vendor Details' }} />
      <Stack.Screen name="fuel" options={{ title: 'Fuel Records' }} />
    </Stack>
  );
}
