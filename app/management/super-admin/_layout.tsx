import { Stack } from 'expo-router';
import { ManagementRoleGate } from '../../../components/management/ManagementRoleGate';
import { CLEAR_HIDDEN_STACK_SCREEN_OPTIONS } from '../../../components/ui/stackScreenOptions';

export default function SuperAdminLayout() {
  return <ManagementRoleGate role="super_admin"><Stack screenOptions={CLEAR_HIDDEN_STACK_SCREEN_OPTIONS} /></ManagementRoleGate>;
}
