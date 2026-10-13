export function isWarehouseJob(job: any, materials: any[] = []): boolean {
  return Boolean(job?.isWarehouseDelivery || job?.isWarehouseMaterial)
    || [job?.deliveryOrigin, job?.materialSource].some((value) => String(value || '').trim().toLowerCase() === 'warehouse')
    || [job, ...(Array.isArray(job?.materials) ? job.materials : [])].filter(Boolean).some((line: any) => line.isWarehouseMaterial || materials.some((material) => material.isWarehouseMaterial && [material.id, material.materialId].filter(Boolean).some((id) => String(id).toLowerCase() === String(line.materialId || '').toLowerCase())));
}

// Counted/bagged goods are received by the storeman rather than the bulk
// inspector, even when they are not warehouse-originated.
export function isStoremanMaterial(job: any): boolean {
  return isWarehouseJob(job) || !isBulkMaterial(job);
}

/** Tonnes and kilograms are bulk goods; every other supported measure is routed through stores. */
export function isBulkMaterial(job: any): boolean {
  if (isWarehouseJob(job)) return false;
  const lines = (job?.materials?.length ? job.materials : [job]).filter(Boolean);
  return lines.some((line: any) => {
    const unit = String(line.measurementType || line.unit || '').trim().toLowerCase();
    if (line.isBagged || line.isCountable === true || line.countable === true || ['bags', 'pieces', 'litres', 'liters', 'metres', 'millimetres'].includes(unit)) return false;
    // Older weighbridge records without classification remain in the bulk workflow.
    if (!unit && !line.materialCategory && !line.category && !line.materialType && !line.materialName) return true;
    return line.isCountable === false || line.countable === false || ['tonnes', 'tonne', 'tons', 'ton', 't', 'kilograms', 'kilogram', 'kg', 'bulk', 'bulky'].includes(unit)
      || /\b(bulk|bulky|unbagged|murram|aggregate|sand|ballast)\b/i.test(String(line.materialCategory || line.category || line.materialType || line.materialName || ''));
  });
}
