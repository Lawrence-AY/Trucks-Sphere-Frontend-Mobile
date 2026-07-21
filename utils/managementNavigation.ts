import type { Ionicons } from '@expo/vector-icons';
import { MANAGEMENT_ROLES, type ManagementRole } from './access';

export type ManagementNavigationItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  activeRoutes?: string[];
};

export type ManagementNavigationSection = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: ManagementNavigationItem[];
};

export const SuperAdminSidebar: ManagementNavigationSection[] = [
  { title: 'Overview', icon: 'apps-outline', items: [
    { label: 'Dashboard', icon: 'home-outline', route: '/management/dashboard' },
  ] },
  { title: 'Operations', icon: 'radio-outline', items: [
    { label: 'Active Jobs', icon: 'layers-outline', route: '/management/active' },
    { label: 'Purchase Orders', icon: 'document-text-outline', route: '/management/purchase-orders' },
    { label: 'Completed Trips', icon: 'checkmark-done-outline', route: '/management/trips' },
    { label: 'Tracking', icon: 'navigate-outline', route: '/track' },
    { label: 'Dispatch', icon: 'send-outline', route: '/management/dispatch' },
  ] },
  { title: 'Fleet', icon: 'car-outline', items: [
    { label: 'Vendors', icon: 'business-outline', route: '/management/vendors' },
    { label: 'Trucks', icon: 'car-outline', route: '/management/trucks' },
    { label: 'Drivers', icon: 'people-outline', route: '/management/drivers' },
    { label: 'Materials', icon: 'cube-outline', route: '/management/materials' },
    { label: 'Fuel Records', icon: 'water-outline', route: '/management/fuel' },
  ] },
  { title: 'Intelligence', icon: 'bar-chart-outline', items: [
    { label: 'Reports', icon: 'bar-chart-outline', route: '/management/reports' },
    { label: 'Audit Logs', icon: 'document-text-outline', route: '/management/audit-logs' },
  ] },
  { title: 'Administration', icon: 'settings-outline', items: [
    { label: 'Users', icon: 'people-outline', route: '/management/users' },
    { label: 'Role Management', icon: 'shield-checkmark-outline', route: '/management/roles' },
    { label: 'System Settings', icon: 'settings-outline', route: '/management/settings' },
    { label: 'Master Data', icon: 'server-outline', route: '/management/master-data' },
    { label: 'Profile', icon: 'person-outline', route: '/management/profile' },
  ] },
];

export const AdminSidebar: ManagementNavigationSection[] = [
  { title: 'Overview', icon: 'apps-outline', items: [
    { label: 'Dashboard', icon: 'home-outline', route: '/management/dashboard' },
    { label: 'Active Jobs', icon: 'layers-outline', route: '/management/active' },
  ] },
  { title: 'Operations', icon: 'radio-outline', items: [
    { label: 'Purchase Orders', icon: 'document-text-outline', route: '/management/purchase-orders' },
    { label: 'Tracking', icon: 'navigate-outline', route: '/track' },
  ] },
  { title: 'Fleet', icon: 'car-outline', items: [
    { label: 'Vendors', icon: 'business-outline', route: '/management/vendors' },
    { label: 'Trucks', icon: 'car-outline', route: '/management/trucks' },
    { label: 'Drivers', icon: 'people-outline', route: '/management/drivers' },
  ] },
  { title: 'Intelligence', icon: 'bar-chart-outline', items: [
    { label: 'Reports', icon: 'bar-chart-outline', route: '/management/reports' },
  ] },
  { title: 'Account', icon: 'person-outline', items: [
    { label: 'Profile', icon: 'person-outline', route: '/management/profile' },
  ] },
];

export const AdminLiteSidebar: ManagementNavigationSection[] = [
  { title: 'Overview', icon: 'apps-outline', items: [
    { label: 'Dashboard', icon: 'home-outline', route: '/management/dashboard' },
  ] },
  { title: 'Fleet', icon: 'car-outline', items: [
    { label: 'Vendors', icon: 'business-outline', route: '/management/vendors' },
    { label: 'Trucks', icon: 'car-outline', route: '/management/trucks' },
    { label: 'Drivers', icon: 'people-outline', route: '/management/drivers' },
  ] },
  { title: 'Procurement', icon: 'document-text-outline', items: [
    { label: 'Purchase Orders', icon: 'document-text-outline', route: '/management/purchase-orders' },
  ] },
  { title: 'Account', icon: 'person-outline', items: [
    { label: 'Profile', icon: 'person-outline', route: '/management/profile' },
  ] },
];

export function getManagementNavigation(role: string | undefined): ManagementNavigationSection[] {
  switch (role as ManagementRole) {
    case MANAGEMENT_ROLES.SUPER_ADMIN: return SuperAdminSidebar;
    case MANAGEMENT_ROLES.ADMIN: return AdminSidebar;
    case MANAGEMENT_ROLES.ADMIN_LITE: return AdminLiteSidebar;
    default: return [];
  }
}
