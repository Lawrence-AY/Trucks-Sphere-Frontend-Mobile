import { type ReactNode, useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { canAccessRoute, isManagementRole, managementHomeRoute } from '../../utils/access';

const PUBLIC_PREFIXES = ['/(auth)', '/login', '/forgot-password', '/track'];
const MANAGEMENT_CONTROLLED_PREFIXES = ['/management', '/audit-log'];

function isPublicRoute(pathname: string) {
  return pathname === '/' || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isManagementControlledRoute(pathname: string) {
  return MANAGEMENT_CONTROLLED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * A single deep-link guard for every management-controlled route. Route
 * layouts remain useful for native transitions, but this root guard also
 * covers controlled URLs that live outside the /management folder.
 */
export function ManagementRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const requiresAuthentication = !isPublicRoute(pathname);
  const denied = (isManagementControlledRoute(pathname) || (isManagementRole(user?.role) && !isPublicRoute(pathname))) &&
    !canAccessRoute(user?.role, pathname);

  useEffect(() => {
    if (isLoading) return;
    if (requiresAuthentication && !isAuthenticated) {
      router.replace('/(auth)/login' as any);
      return;
    }
    if (isAuthenticated && denied) {
      router.replace((isManagementRole(user?.role) ? managementHomeRoute(user?.role) : '/(auth)/login') as any);
    }
  }, [denied, isAuthenticated, isLoading, requiresAuthentication, user?.role]);

  if (isLoading || (requiresAuthentication && !isAuthenticated) || (isAuthenticated && denied)) {
    return <View style={{ flex: 1 }} />;
  }

  return <>{children}</>;
}
