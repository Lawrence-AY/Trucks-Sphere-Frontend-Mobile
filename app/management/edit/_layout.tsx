import { Stack } from 'expo-router';
import { ManagementRoleGate } from '../../../components/management/ManagementRoleGate';

export default function ManagementEditLayout() {
  return <ManagementRoleGate role="management_edit"><Stack screenOptions={{ headerShown: false }} /></ManagementRoleGate>;
}
