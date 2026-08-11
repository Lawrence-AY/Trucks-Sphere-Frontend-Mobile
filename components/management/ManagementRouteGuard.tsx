import { type ReactNode, useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { canAccessRoute, homeRouteForRole } from '../../utils/access';

const PUBLIC_PREFIXES = ['/(auth)', '/login', '/forgot-password', '/track'];
function isPublicRoute(pathname: string) {
  return pathname === '/' || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * A single deep-link guard for every authenticated route. Route layouts
 * remain useful for native transitions, but this guard ensures that direct
 * URLs cannot bypass the same role policy used by visible navigation.
 */
export function ManagementRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const requiresAuthentication = !isPublicRoute(pathname);
  const denied = !isPublicRoute(pathname) && !canAccessRoute(user?.role, pathname);

  useEffect(() => {
    if (isLoading) return;
    if (requiresAuthentication && !isAuthenticated) {
      router.replace('/(auth)/login' as any);
      return;
    }
    if (isAuthenticated && denied) {
      router.replace(homeRouteForRole(user?.role) as any);
    }
  }, [denied, isAuthenticated, isLoading, requiresAuthentication, user?.role]);

  if (isLoading || (requiresAuthentication && !isAuthenticated) || (isAuthenticated && denied)) {
    return <View style={{ flex: 1 }} />;
  }

  return <>{children}</>;
}
