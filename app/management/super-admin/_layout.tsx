import { Stack } from 'expo-router';
import { ManagementRoleGate } from '../../../components/management/ManagementRoleGate';

export default function SuperAdminLayout() {
  return <ManagementRoleGate role="super_admin"><Stack screenOptions={{ headerShown: false }} /></ManagementRoleGate>;
}
