import { isBulkMaterial } from './warehouse';
import { normalizeJobStatus } from './jobStatus';

export function isAwaitingInspection(job: any): boolean {
  if (normalizeJobStatus(job.status) === 'CANCELLED' || job.materialInspection?.mrfNumber) return false;
  return isBulkMaterial(job) && job.siteWeighInWeight != null;
}
