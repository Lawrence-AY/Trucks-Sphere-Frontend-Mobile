export function isWarehouseJob(job: any, materials: any[] = []): boolean {
  return Boolean(job?.isWarehouseDelivery || job?.isWarehouseMaterial)
    || [job?.deliveryOrigin, job?.materialSource].some((value) => String(value || '').trim().toLowerCase() === 'warehouse')
    || [job, ...(Array.isArray(job?.materials) ? job.materials : [])].filter(Boolean).some((line: any) => line.isWarehouseMaterial || materials.some((material) => material.isWarehouseMaterial && [material.id, material.materialId].filter(Boolean).some((id) => String(id).toLowerCase() === String(line.materialId || '').toLowerCase())));
}
