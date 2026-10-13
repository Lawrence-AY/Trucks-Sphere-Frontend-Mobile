import { normalizeRole } from './access';

export function accountDeletionCopy(role?: string) {
  const contexts: Record<string, [string, string]> = {
    superadmin: ['super administrator', 'system administration, user and role management, fleet operations, orders, and reports'],
    admin: ['administrator', 'your permitted fleet operations, orders, and management reports'],
    adminlite: ['Admin Lite', 'your permitted dashboards, fleet records, and reports'],
    vendor: ['vendor', 'your company’s drivers, trucks, orders, trips, and fuel authorizations'],
    operator_quarry: ['quarry operator', 'your quarry queue, weigh-in, weigh-out, dispatch, and weighbridge history'],
    operator_site: ['site operator', 'site receiving, site weights, delivery records, and receipt notes'],
    operator_fuel: ['fuel operator', 'fuel dispensing, authorization checks, and fuel history'],
    operator_warehouse: ['warehouse operator', 'warehouse shipments, purchase-order dispatch, and shipment history'],
    storeman: ['storekeeper', 'goods receiving, inventory, and store receipt history'],
    inspector: ['inspector', 'assigned inspections, inspection reports, and inspection history'],
  };
  const [label, scope] = contexts[normalizeRole(role)] || ['Truck Sphere', 'the operations and reports assigned to you'];
  return {
    context: `Deleting your ${label} account removes your access to ${scope}.`,
    recovery: `Your sign-in credentials and ${label} profile are deleted after a 21-day recovery period. Signing in before that date cancels the request.`,
    retention: `Records associated with your ${label} work may be retained when required for contractual, tax, safety, or legal obligations. Retained records do not keep your account active or allow sign-in.`,
  };
}
