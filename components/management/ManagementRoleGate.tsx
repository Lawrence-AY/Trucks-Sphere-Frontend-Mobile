import { ReactNode, useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { MANAGEMENT_ROLES, managementHomeRoute, normalizeRole } from '../../utils/access';

/** Prevents a direct URL from opening another management account's folder. */
export function ManagementRoleGate({ role, children }: { role: string; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const actualRole = normalizeRole(user?.role);
  const permitted = actualRole === role || actualRole === MANAGEMENT_ROLES.SUPER_ADMIN;
  useEffect(() => {
    if (actualRole && !permitted) router.replace(managementHomeRoute(actualRole) as any);
  }, [actualRole, permitted]);
  return permitted ? <>{children}</> : <View />;
}
