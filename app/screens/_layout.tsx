import { router } from '../../utils/router';
import { Stack } from 'expo-router';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CLEAR_HIDDEN_STACK_SCREEN_OPTIONS, useClearStackScreenOptions } from '../../components/ui/stackScreenOptions';
import { useTheme } from '../../hooks/useTheme';

function StackBackButton() {
  const colors = useTheme();
  return (
    <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={{ paddingRight: 8, paddingVertical: 4 }}>
      <Ionicons name="chevron-back" size={30} color={colors.text} />
    </TouchableOpacity>
  );
}

export default function ScreensLayout() {
  // These are detail and document screens. Native stack navigation supplies a
  // correctly positioned back control, so do not add a separate menu button.
  const screenOptions = useClearStackScreenOptions();

  return (
    <Stack screenOptions={{ ...screenOptions, headerLeft: () => <StackBackButton /> }}>
      <Stack.Screen name="receipt-note" options={{ title: 'Receipt Note', headerLeft: () => <StackBackButton /> }} />
      <Stack.Screen name="weigh-receipt" options={{ title: 'Weighment Receipt' }} />
      <Stack.Screen name="delivery-note" options={{ title: 'Delivery Note', headerLeft: () => <StackBackButton /> }} />
      <Stack.Screen name="job-details" options={{ title: 'Job Details', headerLeft: () => <StackBackButton /> }} />
      <Stack.Screen name="material-details" options={{ title: 'Material Details' }} />
      <Stack.Screen name="purchase-order" options={{ title: 'Purchase Order', headerLeft: () => <StackBackButton /> }} />
      <Stack.Screen name="material-inspection-report" options={{ title: 'Material Inspection Report', headerLeft: () => <StackBackButton /> }} />
      <Stack.Screen name="vendor-details" options={{ title: 'Vendor Details' }} />
      <Stack.Screen name="driver-history" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
      <Stack.Screen name="truck-history" options={{ title: 'Truck History' }} />
      <Stack.Screen name="vendor-detail" options={{ title: 'Vendor Details' }} />
      <Stack.Screen name="fuel" options={{ title: 'Fuel Records' }} />
    </Stack>
  );
}
