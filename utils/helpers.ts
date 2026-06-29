// Generate unique IDs
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 6);
  return `${timestamp}-${randomPart}-${randomPart2}`.toUpperCase();
}

// Generate job ID for delivery notes
export function generateJobId(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9999) + 1;
  return `JOB-${year}-${String(seq).padStart(4, '0')}`;
}

// Generate PO number
export function generatePONumber(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 999) + 1;
  return `PO-${year}-${String(seq).padStart(3, '0')}`;
}

// Format currency
export function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Format weight
export function formatWeight(weight: number, unit: string = 'tonnes'): string {
  return `${weight.toFixed(1)} ${unit}`;
}

// Format date in EAT (East Africa Time, UTC+3)
export function formatDate(
  dateStr: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  };
  return date.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', ...defaultOptions });
}

// Format time in EAT
export function formatTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleTimeString('en-KE', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format datetime in EAT
export function formatDateTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Format date in EAT with full format: "26 Jun 2026, 08:30 AM"
export function formatEAT(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Get status color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: '#10B981',
    inactive: '#94A3B8',
    suspended: '#EF4444',
    pending: '#F59E0B',
    approved: '#3B82F6',
    in_progress: '#8B5CF6',
    completed: '#10B981',
    cancelled: '#EF4444',
    delivered: '#10B981',
    delayed: '#EF4444',
    assigned: '#3B82F6',
    in_transit: '#F59E0B',
    at_quarry: '#8B5CF6',
    loaded: '#10B981',
    in_transit_to_site: '#F59E0B',
    waiting: '#94A3B8',
    weighing_in: '#3B82F6',
    loading: '#F59E0B',
    weighing_out: '#8B5CF6',
    arrived: '#3B82F6',
    received: '#10B981',
    confirmed: '#059669',
    scheduled: '#F59E0B',
    in_maintenance: '#F59E0B',
    out_of_service: '#EF4444',
  };
  return colors[status] || '#94A3B8';
}

// Format status label
export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Calculate net weight
export function calculateNetWeight(
  weighIn: number,
  weighOut: number
): number {
  return Math.round((weighIn - weighOut) * 100) / 100;
}

// Generate receipt text (for sharing)
export function generateReceiptText(data: {
  stationName: string;
  jobId: string;
  plateNumber: string;
  driverName: string;
  materialName: string;
  weighIn: number;
  weighOut: number;
  netWeight: number;
  timestamp: string;
  operatorName: string;
  location: string;
}): string {
  return `
╔════════════════════════════╗
║    ${data.stationName}
╠════════════════════════════╣
║ WEIGHMENT RECEIPT
║ ─────────────────────────
║ Job ID: ${data.jobId}
║ Plate:  ${data.plateNumber}
║ Driver: ${data.driverName}
║ ─────────────────────────
║ Material: ${data.materialName}
║ Weigh In:  ${data.weighIn.toFixed(1)} tonnes
║ Weigh Out: ${data.weighOut.toFixed(1)} tonnes
║ ─────────────────────────
║ NET:      ${data.netWeight.toFixed(1)} tonnes
║ ─────────────────────────
║ Operator: ${data.operatorName}
║ Location: ${data.location}
║ ${data.timestamp}
║ ─────────────────────────
║ [BARCODE: ${data.jobId}]
║
║      Thank you!
╚════════════════════════════╝
  `.trim();
}

// Get role label
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Admin',
    management: 'Management',
    operator_quarry: 'Quarry Operator',
    operator_site: 'Site Operator',
    vendor: 'Vendor',
  };
  return labels[role] || role;
}

// Checkpoint type display config
export interface CheckpointConfig {
  icon: string;
  label: string;
  color: string;
}

export const checkpointConfig: Record<string, CheckpointConfig> = {
  origin: { icon: 'home', label: 'Origin', color: '#1B2A4A' },
  weigh_in: { icon: 'arrow-down-circle', label: 'Weigh-In', color: '#3B82F6' },
  weigh_out: { icon: 'arrow-up-circle', label: 'Weigh-Out', color: '#8B5CF6' },
  arrived_site: { icon: 'location', label: 'Arrived at Site', color: '#3B82F6' },
  received: { icon: 'checkmark-circle', label: 'Received', color: '#10B981' },
};

// Journey flow order (defines the canonical sequence)
export const JOURNEY_STEPS: { type: string; label: string; icon: string; color: string }[] = [
  { type: 'origin', label: 'Origin', icon: 'home', color: '#1B2A4A' },
  { type: 'weigh_in', label: 'Weigh-In', icon: 'arrow-down-circle', color: '#3B82F6' },
  { type: 'weigh_out', label: 'Weigh-Out', icon: 'arrow-up-circle', color: '#8B5CF6' },
  { type: 'arrived_site', label: 'Arrived at Site', icon: 'location', color: '#3B82F6' },
  { type: 'received', label: 'Received', icon: 'checkmark-circle', color: '#10B981' },
];

// Checkpoint type enum
export type CheckpointType = 'origin' | 'weigh_in' | 'weigh_out' | 'arrived_site' | 'received';

/** Determine the current step index based on completed checkpoints */
export function getCurrentStepIndex(checkpoints: { type: string; }[]): number {
  const completedTypes = new Set(checkpoints.map(cp => cp.type));
  for (let i = JOURNEY_STEPS.length - 1; i >= 0; i--) {
    if (completedTypes.has(JOURNEY_STEPS[i].type)) return i + 1;
  }
  return 0;
}

export interface Checkpoint {
  id: string;
  deliveryOrderId: string;
  jobId: string;
  type: CheckpointType;
  timestamp: string;
  location: string;
  notes?: string;
}
