function personName(value: any): string {
  return typeof value === 'string' ? value : value?.displayName || value?.fullName || value?.name || value?.email || '';
}
export function receiptReference(job: any): string {
  return String(job?.receiptNoteId || job?.receiptNote || job?.grnNumber || '').trim();
}
export function deliveryLot(job: any): string {
  const lots = [job?.storageLot, job?.lotNumber, job?.destinationLot, ...(job?.materials || []).map((line: any) => line.storageLot || line.lotNumber || line.destinationLot)].filter(Boolean);
  return [...new Set(lots)].join(', ');
}
export function receivingPerson(job: any): string {
  return [job?.siteWeighOutByName, job?.siteWeighInByName, job?.receivedByName, job?.receivedBy, job?.siteOperatorName, job?.warehouseAcceptedByName, job?.materialInspection?.inspectorName, job?.siteFlaggedBy].map(personName).find(Boolean) || '';
}
export function deliveryPerson(job: any): string {
  return personName(job?.driverName || job?.driver || job?.driverFullName);
}
export function hasReceipt(job: any): boolean {
  return Boolean(receiptReference(job) || job?.siteWeighOutAt || job?.siteWeighOutWeight != null || job?.warehouseAcceptedAt || job?.materialInspection?.mrfNumber || ['SITE_WEIGHED_OUT', 'COMPLETED', 'RECEIPT_UPLOADED', 'RECONCILIATION'].includes(String(job?.status || '').toUpperCase()));
}
