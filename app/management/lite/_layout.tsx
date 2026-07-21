import { Stack } from 'expo-router';
import { ManagementRoleGate } from '../../../components/management/ManagementRoleGate';

export default function ManagementLiteLayout() {
  return <ManagementRoleGate role="management_lite"><Stack screenOptions={{ headerShown: false }} /></ManagementRoleGate>;
}
