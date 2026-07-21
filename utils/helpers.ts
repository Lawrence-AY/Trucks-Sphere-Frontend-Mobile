/**
 * Helper utilities for TruckSphere
 */

/**
 * Format a date string to East African Time (EAT, UTC+3)
 */
export function formatEAT(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi',
      timeZoneName: 'short',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatEAT(dateStr);
  } catch {
    return dateStr;
  }
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-KE');
}

/**
 * Format weight/quantity
 */
export function formatQuantity(value: number, unit: string = 'Tonnes'): string {
  return `${formatNumber(value)} ${unit}`;
}

/**
 * Generate a unique ID (for optimistic updates)
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Status color mapping
 */
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#D1FAE5', text: '#065F46' },
  inactive: { bg: '#FEF3C7', text: '#92400E' },
  suspended: { bg: '#FEE2E2', text: '#991B1B' },
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  approved: { bg: '#DBEAFE', text: '#1E40AF' },
  in_progress: { bg: '#EDE9FE', text: '#5B21B6' },
  completed: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
  archived: { bg: '#F3F4F6', text: '#6B7280' },
  on_trip: { bg: '#DBEAFE', text: '#1E40AF' },
  delayed: { bg: '#FEF3C7', text: '#92400E' },
};

// ─── Legacy helper aliases (for backward compatibility) ───

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status]?.text || '#6B7280';
}

export function formatStatus(status: string): string {
  return status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    superadmin: 'Super Admin',
    super_admin: 'Super Admin',
    admin: 'Admin',
    adminlite: 'Admin Lite',
    management: 'Admin',
    management_edit: 'Admin',
    management_lite: 'Admin Lite',
    operator_quarry: 'Quarry Operator',
    operator_site: 'Site Operator',
    operator_fuel: 'Fuel Operator',
    quarry_operator: 'Quarry Operator',
    site_operator: 'Site Operator',
    fuel_operator: 'Fuel Operator',
    vendor: 'Vendor',
    driver: 'Driver',
  };
  return labels[role] || role;
}

export function formatDate(dateStr: string): string {
  return formatEAT(dateStr);
}

export function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  return formatEAT(dateStr);
}

export function formatWeight(weight: number, unit: string = 'Tonnes'): string {
  return `${formatNumber(weight)} ${unit}`;
}

export function formatCurrency(amount: number): string {
  return `KES ${formatNumber(amount)}`;
}

export function normalizeVendorId(id?: string): string {
  return (id || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

export function generateId(): string {
  return generateTempId();
}

function padToThree(id: string): string {
  const num = id.replace(/^[VvDdTtJj]/, '').replace(/[^0-9]/g, '');
  const parsed = parseInt(num, 10);
  return isNaN(parsed) ? num.padStart(3, '0') : String(parsed).padStart(3, '0');
}

function classifyId(id: string): string {
  const upper = id.toUpperCase();
  if (upper.startsWith('V')) return 'V';
  if (upper.startsWith('D')) return 'D';
  if (upper.startsWith('T')) return 'T';
  return 'J';
}

/**
 * Normalize a poNumber to its base form by stripping any vendor segment
 * that may already be appended (e.g., "POMAT003/V001" → "POMAT003").
 * This prevents duplication when the vendorId is also passed separately.
 */
function normalizePoNumber(poNumber: string): string {
  // Strip any trailing /V### segment from the poNumber
  return poNumber.replace(/\/[Vv]\d+$/, '');
}

/**
 * Generate the job key (base identifier without the J number).
 * Format: POMAT###/V###/D###/T###
 * e.g. "POMAT003/V001/D004/T010"
 *
 * The poNumber may already contain a vendor suffix (e.g. "POMAT003/V001").
 * This is automatically stripped to prevent duplicate vendor segments.
 *
 * The final J number (e.g., /J0004) is ALWAYS assigned by the backend
 * via the jobIdService to guarantee one shared sequential counter per
 * Purchase Order across all quarries and sites.
 */
export function generateJobKey(poNumber: string, materialId: string, vendorId: string, driverId: string, vehicleId: string): string {
  const basePo = normalizePoNumber(poNumber);
  const vendorPrefix = classifyId(vendorId);
  const vendorNum = padToThree(vendorId);
  const driverPrefix = classifyId(driverId);
  const driverNum = padToThree(driverId);
  const vehiclePrefix = classifyId(vehicleId);
  const vehicleNum = padToThree(vehicleId);
  return `${basePo}/${vendorPrefix}${vendorNum}/${driverPrefix}${driverNum}/${vehiclePrefix}${vehicleNum}`;
}

/**
 * @deprecated Use generateJobKey() instead. The backend now owns job numbering.
 * Kept for backward compatibility with any legacy callers.
 */
export function generateJobId(poNumber: string, materialId: string, vendorId: string, driverId: string, vehicleId: string): string {
  return generateJobKey(poNumber, materialId, vendorId, driverId, vehicleId);
}

export function generatePONumber(): string {
  // PO numbers are generated server-side as POMAT### via counterService
  return '';
}

export function generateReceiptNoteId(jobId?: string): string {
  const suffix = jobId ? String(jobId).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() : Date.now().toString(36).toUpperCase();
  return `RN-${suffix}`;
}

export function generateFuelRecordId(): string {
  return `FUEL-${Date.now().toString(36).toUpperCase()}`;
}

export function generateReceiptText(_data?: Record<string, unknown>): string {
  return `Receipt #${Date.now().toString(36).toUpperCase()}`;
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export const JOURNEY_STEPS = [
  'Draft',
  'Assigned',
  'Ready',
  'Loading',
  'Quarry In',
  'Quarry Out',
  'In Transit',
  'Site In',
  'Offloading',
  'Site Out',
  'Receipt Uploaded',
  'Reconciliation',
  'Completed',
];
