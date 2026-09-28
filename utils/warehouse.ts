export function isWarehouseJob(job: any, materials: any[] = []): boolean {
  return Boolean(job?.isWarehouseDelivery || job?.isWarehouseMaterial)
    || [job?.deliveryOrigin, job?.materialSource].some((value) => String(value || '').trim().toLowerCase() === 'warehouse')
    || [job, ...(Array.isArray(job?.materials) ? job.materials : [])].filter(Boolean).some((line: any) => line.isWarehouseMaterial || materials.some((material) => material.isWarehouseMaterial && [material.id, material.materialId].filter(Boolean).some((id) => String(id).toLowerCase() === String(line.materialId || '').toLowerCase())));
}

// Counted/bagged goods are received by the storeman rather than the bulk
// inspector, even when they are not warehouse-originated.
export function isStoremanMaterial(job: any): boolean {
  const lines = [job, ...(Array.isArray(job?.materials) ? job.materials : [])].filter(Boolean);
  return lines.some((line: any) => {
    const unit = String(line.measurementType || line.unit || '').trim().toLowerCase();
    return line.isBagged === true || ['bags', 'litres', 'pieces', 'millimetres', 'metres', 'cubic metres'].includes(unit);
  });
}

/** Tonnes and kilograms are bulk goods; every other supported measure is routed through stores. */
export function isBulkMaterial(job: any): boolean {
  const lines = [job, ...(Array.isArray(job?.materials) ? job.materials : [])].filter(Boolean);
  return lines.some((line: any) => ['tonnes', 'kilograms'].includes(String(line.measurementType || line.unit || '').trim().toLowerCase()));
}
