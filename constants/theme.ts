export const Colors = {
  light: {
    primary: '#0D3150',     
    primaryLight: '#E7F5FC',
    accent: '#25D366',       // WhatsApp green
    success: '#25D366',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: '#E9EDEF',
    surface: '#FFFFFF',
    text: '#1F2C34',
    textSecondary: '#3B4A54',
    textMuted: '#667781',
    textTertiary: '#8696A0',
    border: '#D9E1E5',
    borderLight: '#F4F6F7',
    receiptBg: '#FFFDF7',
    receiptBorder: '#E5E0D5',
    badgeManagement: '#1B2A4A',
    badgeQuarry: '#10B981',
    badgeSite: '#8B5CF6',
    badgeVendor: '#F59E0B',
    overlay: 'rgba(0,0,0,0.5)',
    inputBg: '#F7F9FA',
    cardShadow: 'rgba(0,0,0,0.06)',
    gradientStart: '#0D3150',
    gradientEnd: '#0D3150',
  },
  dark: {
    primary: '#2b77b9',
    primaryLight: '#0D3150',
    accent: '#31E7D0',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#F87171',
    background: '#06111F',
    surface: '#0D1B2B',
    text: '#F8FAFC',
    textSecondary: '#B6C7D8',
    textMuted: '#7D92A7',
    textTertiary: '#5E7287',
    border: '#1F344A',
    borderLight: '#13283D',
    receiptBg: '#1C1917',
    receiptBorder: '#44403C',
    badgeManagement: '#2D4A7A',
    badgeQuarry: '#34D399',
    badgeSite: '#A78BFA',
    badgeVendor: '#FBBF24',
    overlay: 'rgba(0,0,0,0.7)',
    inputBg: '#091827',
    cardShadow: 'rgba(0,0,0,0.2)',
    gradientStart: '#06111F',
    gradientEnd: '#0E2D47',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const Typography = {
  caption: { fontSize: 12, lineHeight: 16 },
  secondary: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 14, lineHeight: 20 },
  message: { fontSize: 15, lineHeight: 21 },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  sectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' as const },
  screenTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800' as const },
  receipt: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 18,
  },
  receiptTitle: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold' as const,
    lineHeight: 22,
  },
  receiptSmall: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 14,
  },
};

export const TAB_CONFIG = {
  admin: [
    { name: 'dashboard', label: 'Dashboard', icon: 'grid-outline' as const },
    { name: 'materials', label: 'Materials', icon: 'cube-outline' as const },
    { name: 'drivers', label: 'Drivers', icon: 'people-outline' as const },
    { name: 'trucks', label: 'Vehicles', icon: 'car-outline' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const },
  ],
  management: [
    { name: 'dashboard', label: 'Dashboard', icon: 'grid-outline' as const },
    { name: 'drivers', label: 'Drivers', icon: 'people-outline' as const },
    { name: 'trucks', label: 'Trucks', icon: 'car-outline' as const },
    { name: 'orders', label: 'Orders', icon: 'document-text-outline' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const },
  ],
  operator_quarry: [
    { name: 'dashboard', label: 'Queue', icon: 'clipboard-outline' as const },
    { name: 'weigh-in', label: 'Weigh In', icon: 'download-outline' as const },
    { name: 'weigh-out', label: 'Weigh Out', icon: 'upload-outline' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const },
  ],
  operator_site: [
    { name: 'dashboard', label: 'Schedule', icon: 'calendar-outline' as const },
    { name: 'receive', label: 'Receive', icon: 'checkmark-circle-outline' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const },
  ],
  vendor: [
    { name: 'dashboard', label: 'Dashboard', icon: 'home-outline' as const },
    { name: 'orders', label: 'Orders', icon: 'document-text-outline' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const },
  ],
};

export const ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  ADMIN_LITE: 'adminlite',
  MANAGEMENT: 'management',
  OPERATOR_QUARRY: 'operator_quarry',
  OPERATOR_SITE: 'operator_site',
  VENDOR: 'vendor',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];
