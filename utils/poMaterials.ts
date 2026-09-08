export function getPurchaseOrderMaterials(order: any): any[] {
  if (!order) return [];
  return Array.isArray(order.materials) && order.materials.length ? order.materials : [order, ...(order.additionalItems || [])];
}
export function formatPurchaseOrderMaterials(order: any): string {
  return getPurchaseOrderMaterials(order).map((line) => line.materialName || line.productName || 'Material').join(', ');
}
