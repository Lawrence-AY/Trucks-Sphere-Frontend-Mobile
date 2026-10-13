import { Stack } from 'expo-router';
import { CLEAR_HIDDEN_STACK_SCREEN_OPTIONS } from '../../components/ui/stackScreenOptions';

export default function AuthLayout() {
  return (
    <Stack screenOptions={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="login" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
      <Stack.Screen name="forgot-password" options={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />
    </Stack>
  );
}
