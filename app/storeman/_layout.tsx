import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { normalizeRole } from '../../utils/access';

export default function StoremanLayout() {
  const role = normalizeRole(useAuthStore((state) => state.user?.role));
  if (role !== 'storeman') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
