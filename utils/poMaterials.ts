export function getPurchaseOrderMaterials(order: any): any[] {
  if (!order) return [];
  return Array.isArray(order.materials) && order.materials.length ? order.materials : [order, ...(order.additionalItems || [])];
}
export function formatPurchaseOrderMaterials(order: any): string {
  return getPurchaseOrderMaterials(order).map((line) => line.materialName || line.productName || 'Material').join(', ');
}

/** Full PO context for planning and quarry selection, not a dispatched manifest. */
export function getJobPurchaseOrderMaterials(trip: any, orders: any[] = []): any[] {
  if (!trip) return [];
  const order = orders.find(po => trip.purchaseOrderId && po.id === trip.purchaseOrderId)
    || orders.find(po => trip.poNumber && po.poNumber === trip.poNumber);
  return order ? getPurchaseOrderMaterials(order) : getTripMaterials(trip);
}

export function materialSelectionKey(line: any, index: number): string {
  return `${line.materialId || line.materialName || line.productName || 'material'}:${index}`;
}

export function selectedDispatchMaterials(lines: any[], selectedKeys: string[]): any[] {
  return lines.filter((line, index) => lines.length === 1 || selectedKeys.includes(materialSelectionKey(line, index)));
}

export function isPurchaseOrderOpen(order: any): boolean {
  if (!order || ['completed', 'complete', 'delivered', 'fulfilled', 'closed', 'cancelled', 'canceled', 'archived', 'excess', 'overdelivered', 'over_delivered'].includes(String(order.status || '').trim().toLowerCase())) return false;
  return getPurchaseOrderMaterials(order).some((line, index) => {
    if (line.isWarehouseMaterial || order.isWarehouseMaterial) return true;
    if (line.remainingQuantity != null && line.remainingQuantity !== '') return Number(line.remainingQuantity) > 0;
    const target = line.quantity ?? line.quantityOrdered;
    // Weighbridge-imported POs have a vendor and material but no ordered
    // target. Missing quantities are unknown, not zero or exhausted.
    if (target == null || String(target).trim() === '') {
      return Boolean(order.vendorId && (line.materialId || line.materialName));
    }
    const allocated = line.allocatedQuantity ?? line.quantityDelivered ?? line.deliveredQuantity
      ?? (index === 0 ? order.allocatedQuantity ?? order.quantityDelivered ?? order.deliveredQuantity : 0) ?? 0;
    return Number(target) > Number(allocated);
  });
}

/** A dispatch manifest is authoritative; PO lines only fill genuinely missing context. */
export function getTripMaterials(trip: any, orders: any[] = []): any[] {
  if (!trip) return [];
  if (Array.isArray(trip.materials) && trip.materials.length) return trip.materials;
  if (trip.additionalItems?.length) return getPurchaseOrderMaterials(trip);
  const order = orders.find((po) => (trip.purchaseOrderId && po.id === trip.purchaseOrderId) || (trip.poNumber && po.poNumber === trip.poNumber));
  if (trip.materialId || trip.materialName) {
    const source = getPurchaseOrderMaterials(order).find((line) => trip.materialId ? line.materialId === trip.materialId : line.materialName === trip.materialName);
    return [{ ...source, ...trip, quantity: trip.quantityDispatched ?? trip.quantityOrdered ?? trip.quantity ?? source?.quantity }];
  }
  return getPurchaseOrderMaterials(order || trip);
}

export function formatTripMaterials(trip: any, orders: any[] = []): string {
  return getTripMaterials(trip, orders).map((line, index) => {
    const quantity = line.quantityDispatched ?? line.quantity ?? line.quantityOrdered;
    return `${index + 1}. ${line.materialName || line.productName || 'Material'}${quantity != null ? ` (${quantity} ${line.unit || ''})` : ''}`;
  }).join('\n');
}
