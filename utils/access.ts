export const MANAGEMENT_ROLES = {
  SUPER_ADMIN: 'super_admin',
  EDIT: 'management_edit',
  LITE: 'management_lite',
} as const;

export function normalizeRole(role?: string): string {
  if (role === 'admin') return MANAGEMENT_ROLES.SUPER_ADMIN;
  if (role === 'management') return MANAGEMENT_ROLES.EDIT;
  return role || '';
}

export function isManagementRole(role?: string): boolean {
  return Object.values(MANAGEMENT_ROLES).includes(normalizeRole(role) as any);
}

export function managementHomeRoute(role?: string): string {
  switch (normalizeRole(role)) {
    case MANAGEMENT_ROLES.SUPER_ADMIN: return '/management/super-admin';
    case MANAGEMENT_ROLES.EDIT: return '/management/edit';
    // Lite starts on the shared dashboard tab, which renders its focused
    // fleet overview. This keeps its first screen and tab selection aligned.
    case MANAGEMENT_ROLES.LITE: return '/management/dashboard';
    default: return '/(auth)/login';
  }
}

export function canAccessManagementRoute(role: string | undefined, route: string): boolean {
  const value = normalizeRole(role);
  if (value === MANAGEMENT_ROLES.SUPER_ADMIN) return route.startsWith('/management');
  if (value === MANAGEMENT_ROLES.EDIT) {
    // Management Edit has the same shared management modules as Super Admin,
    // apart from Master Data. The role-home folders remain role-specific.
    return route.startsWith('/management/edit') || !['/management/super-admin', '/management/lite', '/management/master-data'].some((path) => route.startsWith(path));
  }
  if (value === MANAGEMENT_ROLES.LITE) {
    // Lite is limited to fleet records, orders, and the user's own profile.
    // Create/detail paths are included so its dashboard actions remain usable.
    return [
      '/management/lite',
      '/management/dashboard',
      '/management/orders',
      '/management/vendors',
      '/management/drivers',
      '/management/trucks',
      '/management/vehicles',
      '/management/profile',
    ].some((path) => route.startsWith(path));
  }
  return false;
}
