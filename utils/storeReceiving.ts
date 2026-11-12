import { isBulkMaterial, isWarehouseJob } from './warehouse';

export const receivingLines = (job: any): any[] => job?.materials?.length ? job.materials : [
  { materialId: job?.materialId, materialName: job?.materialName, quantity: job?.quantityOrdered, unit: job?.unit },
  ...(job?.additionalItems || []),
];

const WEIGHT_UNITS = new Set(['tonne', 'tonnes', 'ton', 'tons', 't', 'kg', 'kilogram', 'kilograms']);
const GENERIC_UNITS = new Set(['unit', 'units', 'each', 'no', 'nos']);
const COUNT_UNITS = new Set(['piece', 'pieces', 'pc', 'pcs', 'bag', 'bags', 'set', 'sets', 'box', 'boxes', 'pack', 'packs', 'roll', 'rolls', 'length', 'lengths']);

/** Display count-based material quantities as whole numbers. */
export function formatStoreQuantity(value: unknown, unit: string): string {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (COUNT_UNITS.has(String(unit || '').trim().toLowerCase())) return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(numeric);
  return String(value);
}

export function isStoreNonBulkMaterial(job: any): boolean {
  if (isBulkMaterial(job)) return false;
  const lines = job?.materials?.length ? job.materials : [job, ...(job?.additionalItems || [])].filter(Boolean);
  return !lines.some((line: any) => {
    const category = String(line?.materialCategory || line?.category || '').trim().toLowerCase();
    if (['aggregate', 'aggregates', 'liquid', 'liquids'].includes(category)) return true;
    if (['cement', 'binder'].includes(category)) {
      const subtype = String(line?.cementSubtype || line?.materialSubtype || line?.subtype || '').trim().toLowerCase();
      return !(line?.isBagged || ['bagged', 'cement-bagged'].includes(subtype));
    }
    return false;
  });
}

/** Use the material's own measure, never the truck's weighbridge weight, for store counts. */
export function storeMaterialUnit(line: any, fallback = ''): string {
  const explicit = String(line?.measurementType || line?.defaultUnit || line?.unit || fallback || '').trim();
  const receiptUnit = String(fallback || '').trim();
  const isWeight = (value: string) => WEIGHT_UNITS.has(value.toLowerCase());
  const isGeneric = (value: string) => GENERIC_UNITS.has(value.toLowerCase());
  if (explicit && !isWeight(explicit) && !isGeneric(explicit)) return explicit;
  const category = String(line?.materialCategory || line?.category || '').trim().toLowerCase();
  const subtype = String(line?.cementSubtype || line?.materialSubtype || line?.subtype || '').trim().toLowerCase();
  const name = String(line?.materialName || line?.productName || line?.materialType || line?.name || '').trim().toLowerCase();
  if (category === 'cement' && (line?.isBagged || ['bagged', 'cement-bagged'].includes(subtype) || /bagged|\bbag\b/.test(name))) return 'Bags';
  if (['aggregate', 'aggregates', 'liquid', 'liquids'].includes(category) || (category === 'cement' && !line?.isBagged && !['bagged', 'cement-bagged'].includes(subtype))) return explicit || receiptUnit || 'Tonnes';
  if (explicit && isWeight(explicit) && isBulkMaterial(line)) return explicit;
  if (category === 'blocks' || /\b(blocks?|bricks?|pipes?|ducts?|fittings?|valves?|bolts?|nuts?|screws?)\b/.test(name)) return 'Pieces';
  if (/\b(cables?|conduits?|timber|pipes?)\b/.test(name) && /\b(metre|meter|length)\b/.test(name)) return 'Metres';
  if (receiptUnit && !isWeight(receiptUnit) && !isGeneric(receiptUnit)) return receiptUnit;
  if (['steel', 'other', 'warehouse'].includes(category) || explicit) return 'Pieces';
  return fallback || 'Pieces';
}
export function isStoreIncoming(job: any): boolean {
  if (job.receivingStatus || job.materialInspection?.materialReceipts?.length || job.warehouseDeniedAt) return false;
  const status = String(job.status || '').toUpperCase();
  if (status === 'CANCELLED' || !isStoreNonBulkMaterial(job)) return false;
  if (isWarehouseJob(job)) {
    // Warehouse deliveries are also weighed at site. Once the site has
    // recorded arrival, store receiving must be able to see the delivery;
    // waiting for site weigh-out here left the queue at zero indefinitely.
    return Boolean(
      job.warehouseAcceptedAt
      || job.siteWeighInWeight != null
      || job.siteArrivalWeight != null
      || ['ARRIVED_AT_SITE', 'SITE_WEIGHED_IN', 'SITE_WEIGHED_OUT', 'COMPLETED'].includes(status),
    );
  }
  return job.siteWeighInWeight != null || job.siteArrivalWeight != null || Boolean(job.arrivedAtSiteAt || job.siteInTime) || ['ARRIVED_AT_SITE', 'SITE_WEIGHED_IN', 'SITE_WEIGHED_OUT', 'COMPLETED'].includes(status);
}
export const isStorePendingInspection = (job: any): boolean => job.receivingStatus === 'received_pending_inspection' && job.storeReceiving?.condition === 'Pass' && isStoreNonBulkMaterial(job);
export const receivingStatusLabel = (job: any): string => ({
  received_pending_inspection: 'Pending Inspection', receiving_rejected: 'Receiving rejected · Flagged',
  inspection_rejected: 'Inspection rejected · Flagged', inventory_added: 'Inventory Added',
}[String(job.receivingStatus)] || 'Inspected');
export const receivedLines = (job: any): any[] => job?.materialInspection?.materialReceipts || job?.storeReceiving?.materialReceipts || [];
export const receivingDate = (value: any): string => value ? new Date(value).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' }) : '—';
