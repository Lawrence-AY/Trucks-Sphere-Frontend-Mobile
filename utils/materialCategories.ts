export function normalizeMaterialCategory(category?: string, warehouse = false): string {
  if (warehouse) return 'Warehouse';
  const key = String(category || '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    aggregate: 'Aggregates', aggregates: 'Aggregates', steel: 'Steel',
    cement: 'Cement', binder: 'Cement', liquid: 'Liquid', liquids: 'Liquid',
    block: 'Blocks', blocks: 'Blocks', warehouse: 'Warehouse', other: 'Other',
  };
  return aliases[key] || 'Other';
}

export function normalizeMaterialCategories<T extends { category?: string; isWarehouseMaterial?: boolean }>(materials: T[]): T[] {
  return materials.map(material => ({ ...material, category: normalizeMaterialCategory(material.category, material.isWarehouseMaterial) }));
}
