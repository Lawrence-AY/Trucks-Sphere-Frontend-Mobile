export const TERMINAL_JOB_STATUSES = ['SITE_WEIGHED_OUT', 'COMPLETED', 'CANCELLED'] as const;

const LEGACY: Record<string, string> = {
  loaded: 'DISPATCHED', dispatched: 'DISPATCHED', in_transit: 'IN_TRANSIT', en_route: 'IN_TRANSIT',
  at_quarry: 'QUARRY_WEIGHED_IN', quarry_in: 'QUARRY_WEIGHED_IN', quarry_out: 'QUARRY_WEIGHED_OUT',
  site_in: 'SITE_WEIGHED_IN', weighed_in: 'SITE_WEIGHED_IN', delivered: 'COMPLETED', completed: 'COMPLETED', cancelled: 'CANCELLED',
};

export function normalizeJobStatus(status?: string): string {
  const value = String(status || '').trim();
  return LEGACY[value.toLowerCase()] || value.toUpperCase();
}

export function isActiveJob(status?: string): boolean {
  return !TERMINAL_JOB_STATUSES.includes(normalizeJobStatus(status) as any);
}
