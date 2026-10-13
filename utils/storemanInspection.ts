export const STOREMAN_GENERAL_METRICS = [
  'Material identity / grade verified',
  'No contamination or foreign material',
  'Acceptable moisture and physical condition',
] as const;

export function storemanInspectionReady(result: string | undefined, metrics: Record<string, boolean> = {}, reason = ''): boolean {
  if (result === 'Failed') return Boolean(reason.trim());
  return result === 'Pass' && STOREMAN_GENERAL_METRICS.every(metric => metrics[metric] === true);
}
