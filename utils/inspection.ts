import { isWarehouseJob } from './warehouse';
import { normalizeJobStatus } from './jobStatus';

export function isAwaitingInspection(job: any): boolean {
  if (normalizeJobStatus(job.status) === 'CANCELLED' || job.materialInspection?.mrfNumber) return false;
  return isWarehouseJob(job) ? Boolean(job.warehouseAcceptedAt) : job.siteWeighInWeight != null;
}
