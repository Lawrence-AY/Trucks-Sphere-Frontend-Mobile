export function vendorName(vendor: any): string {
  return String(vendor.companyName || vendor.name || '').trim() || 'Unknown Vendor';
}

export function vendorOptions(vendors: any[]) {
  return vendors.map((vendor) => ({
    id: vendor.id,
    name: `${String(vendor.vendorId || vendor.id).replace(/^V/i, '')} - ${vendorName(vendor)}`,
  })).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id));
}
