export function getPurchaseOrderMaterials(order: any): any[] {
  if (!order) return [];
  return Array.isArray(order.materials) && order.materials.length ? order.materials : [order, ...(order.additionalItems || [])];
}
export function formatPurchaseOrderMaterials(order: any): string {
  return getPurchaseOrderMaterials(order).map((line) => line.materialName || line.productName || 'Material').join(', ');
}

export function isPurchaseOrderOpen(order: any): boolean {
  if (!order || ['completed', 'complete', 'delivered', 'fulfilled', 'closed', 'cancelled', 'canceled', 'archived', 'excess', 'overdelivered', 'over_delivered'].includes(String(order.status || '').trim().toLowerCase())) return false;
  return getPurchaseOrderMaterials(order).some((line, index) => {
    if (line.isWarehouseMaterial) return true;
    if (line.remainingQuantity != null && line.remainingQuantity !== '') return Number(line.remainingQuantity) > 0;
    const allocated = line.allocatedQuantity ?? line.quantityDelivered ?? line.deliveredQuantity
      ?? (index === 0 ? order.allocatedQuantity ?? order.quantityDelivered ?? order.deliveredQuantity : 0) ?? 0;
    return Number(line.quantity ?? line.quantityOrdered ?? 0) > Number(allocated);
  });
}

/** Prefer a trip's manifest; older trips may only carry a PO reference. */
export function getTripMaterials(trip: any, orders: any[] = []): any[] {
 if (trip?.materials?.length || trip?.additionalItems?.length) return getPurchaseOrderMaterials(trip);
 const order = orders.find((po) => po.id === trip?.purchaseOrderId);
 return getPurchaseOrderMaterials(order || trip);
}
