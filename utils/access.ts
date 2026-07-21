/**
 * The management access policy lives here so navigation, screen guards and
 * action controls all make the same decision.  The API mirrors these roles in
 * its authorization middleware; this client policy is never the sole control.
 */
export const MANAGEMENT_ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  ADMIN_LITE: 'adminlite',
  // Kept as aliases while older callers are migrated.
  EDIT: 'admin',
  LITE: 'adminlite',
} as const;

export type ManagementRole = typeof MANAGEMENT_ROLES.SUPER_ADMIN
  | typeof MANAGEMENT_ROLES.ADMIN
  | typeof MANAGEMENT_ROLES.ADMIN_LITE;

export const MANAGEMENT_ROLE_OPTIONS = [
  { id: MANAGEMENT_ROLES.SUPER_ADMIN, name: 'Super Admin' },
  { id: MANAGEMENT_ROLES.ADMIN, name: 'Admin' },
  { id: MANAGEMENT_ROLES.ADMIN_LITE, name: 'Admin Lite' },
] as const;

const ROLE_ALIASES: Record<string, ManagementRole> = {
  superadmin: MANAGEMENT_ROLES.SUPER_ADMIN,
  super_admin: MANAGEMENT_ROLES.SUPER_ADMIN,
  admin: MANAGEMENT_ROLES.ADMIN,
  management: MANAGEMENT_ROLES.ADMIN,
  management_edit: MANAGEMENT_ROLES.ADMIN,
  adminlite: MANAGEMENT_ROLES.ADMIN_LITE,
  admin_lite: MANAGEMENT_ROLES.ADMIN_LITE,
  management_lite: MANAGEMENT_ROLES.ADMIN_LITE,
};

export function normalizeRole(role?: string): string {
  const value = String(role || '').trim().toLowerCase();
  return ROLE_ALIASES[value] || value;
}

export function isManagementRole(role?: string): role is ManagementRole {
  const value = normalizeRole(role);
  return value === MANAGEMENT_ROLES.SUPER_ADMIN ||
    value === MANAGEMENT_ROLES.ADMIN ||
    value === MANAGEMENT_ROLES.ADMIN_LITE;
}

export function managementHomeRoute(role?: string): string {
  if (!isManagementRole(role)) return '/(auth)/login';
  return '/management/dashboard';
}

/** Screens that are not a management route but are part of management access. */
const SPECIAL_ROUTE_ACCESS: Array<{ prefix: string; roles: ManagementRole[] }> = [
  { prefix: '/audit-log', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/operations/jobs', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
];

/**
 * Explicit route policy.  More-specific prefixes must occur before their
 * parents.  A route without an entry is denied to management users, which
 * makes newly-added screens safe by default until their policy is declared.
 */
const MANAGEMENT_ROUTE_ACCESS: Array<{ prefix: string; roles: ManagementRole[] }> = [
  { prefix: '/management/super-admin', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/edit', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/lite', roles: [MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/users', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/roles', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/settings', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/master-data', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/audit-logs', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/quarries', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/sites', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/analytics', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
  { prefix: '/management/reports', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
  { prefix: '/management/dispatch', roles: [MANAGEMENT_ROLES.SUPER_ADMIN] },
  { prefix: '/management/fuel-records', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
  { prefix: '/management/fuel', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
  { prefix: '/management/trips', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
  { prefix: '/management/active', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
  { prefix: '/management/materials', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
  { prefix: '/management/purchase-orders/edit', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN] },
  { prefix: '/management/vendors/create', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/vendors/edit', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/drivers/create', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/vehicles/create', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/purchase-orders', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/orders', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/vendors', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/drivers', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/vehicles', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/trucks', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/profile', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management/dashboard', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
  { prefix: '/management', roles: [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE] },
];

function routeMatches(route: string, prefix: string) {
  return route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`);
}

export function canAccessManagementRoute(role: string | undefined, route: string): boolean {
  const normalizedRole = normalizeRole(role);
  if (!isManagementRole(normalizedRole)) return false;
  const policy = MANAGEMENT_ROUTE_ACCESS.find((entry) => routeMatches(route, entry.prefix));
  return Boolean(policy?.roles.includes(normalizedRole));
}

export function canAccessRoute(role: string | undefined, route: string): boolean {
  // Public delivery tracking is deliberately available without an account.
  if (routeMatches(route, '/track')) return true;
  if (route.startsWith('/management')) return canAccessManagementRoute(role, route);
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === MANAGEMENT_ROLES.SUPER_ADMIN) return true;
  const policy = SPECIAL_ROUTE_ACCESS.find((entry) => routeMatches(route, entry.prefix));
  if (isManagementRole(normalizedRole)) {
    return Boolean(policy?.roles.includes(normalizedRole));
  }
  return !policy;
}

export type ManagementPermission =
  | 'vendors.write'
  | 'trucks.write'
  | 'drivers.write'
  | 'purchaseOrders.create'
  | 'purchaseOrders.edit'
  | 'users.manage'
  | 'roles.manage'
  | 'settings.manage';

const PERMISSIONS: Record<ManagementPermission, ManagementRole[]> = {
  'vendors.write': [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN_LITE],
  'trucks.write': [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN_LITE],
  'drivers.write': [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN_LITE],
  'purchaseOrders.create': [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN, MANAGEMENT_ROLES.ADMIN_LITE],
  'purchaseOrders.edit': [MANAGEMENT_ROLES.SUPER_ADMIN, MANAGEMENT_ROLES.ADMIN],
  'users.manage': [MANAGEMENT_ROLES.SUPER_ADMIN],
  'roles.manage': [MANAGEMENT_ROLES.SUPER_ADMIN],
  'settings.manage': [MANAGEMENT_ROLES.SUPER_ADMIN],
};

export function hasManagementPermission(role: string | undefined, permission: ManagementPermission): boolean {
  const normalizedRole = normalizeRole(role);
  return isManagementRole(normalizedRole) && PERMISSIONS[permission].includes(normalizedRole);
}
