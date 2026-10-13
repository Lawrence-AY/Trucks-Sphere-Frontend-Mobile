import { isBulkMaterial, isWarehouseJob } from './warehouse';

export const receivingLines = (job: any): any[] => job?.materials?.length ? job.materials : [
  { materialId: job?.materialId, materialName: job?.materialName, quantity: job?.quantityOrdered, unit: job?.unit },
  ...(job?.additionalItems || []),
];
export function isStoreIncoming(job: any): boolean {
  if (job.receivingStatus || job.materialInspection?.materialReceipts?.length || job.warehouseDeniedAt) return false;
  const status = String(job.status || '').toUpperCase();
  if (status === 'CANCELLED' || isBulkMaterial(job)) return false;
  if (isWarehouseJob(job)) {
    if ((job.siteWeighInWeight != null || job.siteArrivalWeight != null) && job.siteWeighOutWeight == null) return false;
    return Boolean(job.warehouseAcceptedAt);
  }
  return job.siteWeighInWeight != null || job.siteArrivalWeight != null || Boolean(job.arrivedAtSiteAt) || ['ARRIVED_AT_SITE', 'SITE_WEIGHED_IN', 'SITE_WEIGHED_OUT', 'COMPLETED'].includes(status);
}
export const isStorePendingInspection = (job: any): boolean => job.receivingStatus === 'received_pending_inspection' && job.storeReceiving?.condition === 'Pass';
export const receivingStatusLabel = (job: any): string => ({
  received_pending_inspection: 'Pending Inspection', receiving_rejected: 'Receiving rejected · Flagged',
  inspection_rejected: 'Inspection rejected · Flagged', inventory_added: 'Inventory Added',
}[String(job.receivingStatus)] || 'Inspected');
export const receivedLines = (job: any): any[] => job?.materialInspection?.materialReceipts || job?.storeReceiving?.materialReceipts || [];
export const receivingDate = (value: any): string => value ? new Date(value).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' }) : '—';
