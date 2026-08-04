import { Stack } from 'expo-router';
import { CLEAR_HIDDEN_STACK_SCREEN_OPTIONS } from '../../components/ui/stackScreenOptions';

export default function WarehouseLayout() {
  return <Stack screenOptions={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} />;
}
 