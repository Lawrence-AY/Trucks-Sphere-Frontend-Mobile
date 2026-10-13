import { isBulkMaterial, isStoremanMaterial, isWarehouseJob } from './warehouse';
import { normalizeJobStatus } from './jobStatus';

export function isAwaitingInspection(job: any): boolean {
  if (normalizeJobStatus(job.status) === 'CANCELLED' || job.materialInspection?.mrfNumber) return false;
  if (isWarehouseJob(job)) return false;
  const weighedIn = job.siteWeighInWeight != null || job.siteArrivalWeight != null;
  const hasMeasure = [job, ...(job.materials || [])].some((line: any) => line.unit || line.measurementType);
  return weighedIn && (isBulkMaterial(job) || (!hasMeasure && !isStoremanMaterial(job)));
}
