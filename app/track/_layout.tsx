import { Stack } from 'expo-router';

export default function TrackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[trackingId]" />
    </Stack>
  );
}