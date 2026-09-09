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
    { label: 'Dashboard', icon: 'grid-outline', route: '/management/dashboard' },
  ] },
  { title: 'Operations', icon: 'radio-outline', items: [
    { label: 'Active Jobs', icon: 'pulse-outline', route: '/management/active' },
    { label: 'Purchase Orders', icon: 'document-text-outline', route: '/management/purchase-orders' },
    { label: 'Warehouse', icon: 'cube-outline', route: '/warehouse' },
   // { label: 'Stocks', icon: 'layers-outline', route: '/management/stocks' },
    { label: 'Completed Trips', icon: 'checkmark-done-outline', route: '/management/trips' },
    { label: 'Tracking', icon: 'navigate-outline', route: '/track' },
    { label: 'Security Personnel', icon: 'shield-checkmark-outline', route: '/management/security-personnel' },
    { label: 'Flagged', icon: 'flag-outline', route: '/management/flagged' },
  ] },
  { title: 'Fleet', icon: 'car-outline', items: [
    { label: 'Vendors', icon: 'business-outline', route: '/management/vendors' },
    { label: 'Trucks', icon: 'car-outline', route: '/management/trucks' },
    { label: 'Drivers', icon: 'people-outline', route: '/management/drivers' },
    { label: 'Materials', icon: 'cube-outline', route: '/management/materials' },
    { label: 'Fuel Records', icon: 'water-outline', route: '/management/fuel' },
  ] },
  { title: 'Intelligence', icon: 'bar-chart-outline', items: [
    { label: 'Issues', icon: 'chatbubble-ellipses-outline', route: '/screens/issues' },
    { label: 'Reports', icon: 'bar-chart-outline', route: '/management/reports' },
  ] },
  { title: 'Administration', icon: 'settings-outline', items: [
    { label: 'Users', icon: 'people-outline', route: '/management/users' },
    
    { label: 'Profile', icon: 'person-outline', route: '/management/profile' },
  ] },
];

export const AdminSidebar: ManagementNavigationSection[] = [
  { title: 'Overview', icon: 'apps-outline', items: [
    { label: 'Dashboard', icon: 'grid-outline', route: '/management/dashboard' },
    { label: 'Active Jobs', icon: 'pulse-outline', route: '/management/active' },
  ] },
  { title: 'Operations', icon: 'radio-outline', items: [
    { label: 'Purchase Orders', icon: 'document-text-outline', route: '/management/purchase-orders' },
    { label: 'Warehouse', icon: 'cube-outline', route: '/warehouse' },
    //{ label: 'Stocks', icon: 'layers-outline', route: '/management/stocks' },
    { label: 'Tracking', icon: 'navigate-outline', route: '/track' },
    { label: 'Security Personnel', icon: 'shield-checkmark-outline', route: '/management/security-personnel' },
    { label: 'Flagged', icon: 'flag-outline', route: '/management/flagged' },
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
    { label: 'Dashboard', icon: 'grid-outline', route: '/management/dashboard' },
  ] },
  { title: 'Fleet', icon: 'car-outline', items: [
    { label: 'Vendors', icon: 'business-outline', route: '/management/vendors' },
    { label: 'Trucks', icon: 'car-outline', route: '/management/trucks' },
    { label: 'Drivers', icon: 'people-outline', route: '/management/drivers' },
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
