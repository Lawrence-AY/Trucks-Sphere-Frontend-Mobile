import { Stack } from 'expo-router';
import { CLEAR_HIDDEN_STACK_SCREEN_OPTIONS } from '../../components/ui/stackScreenOptions';

export default function TrackLayout() {
  return (
    <Stack screenOptions={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
      <Stack.Screen name="[plate]" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
    </Stack>
  );
}
