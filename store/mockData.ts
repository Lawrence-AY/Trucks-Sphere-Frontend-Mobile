// ══════════════════════════════════════════════════════════════════
// MOCK DATA — DEPRECATED
// All data is now fetched from the backend API (Firebase-backed).
// This file is kept for type reference only.
// No components import from this file.
// ══════════════════════════════════════════════════════════════════

import {
  Driver,
  Vehicle,
  Material,
  PurchaseOrder,
  WeighRecord,
  DashboardStats,
} from './types';

// Seed IDs use 3-digit padding format:
//   Vendors:   V001, V002, V003
//   Drivers:   D001, D002 ...
//   Vehicles:  T001, T002 ...
//   Materials: MAT001, MAT002 ...
//   PO:        POMAT###/V###
//   Job:       POMAT###/V###/D###/T###/J####

export const MOCK_DRIVERS: Driver[] = [];
export const MOCK_TRUCKS: Vehicle[] = [];
export const MOCK_MATERIALS: Material[] = [];
export const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [];
export const MOCK_DELIVERY_ORDERS: any[] = [];
export const MOCK_WEIGHMENTS: WeighRecord[] = [];

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  todayJobs: 0,
  activeDeliveries: 0,
  delayedJobs: 0,
  pendingDispatch: 0,
  activeVehicles: 0,
  availableDrivers: 0,
  totalVendors: 0,
  totalDrivers: 0,
  totalVehicles: 0,
  todayDeliveries: 0,
  pendingOrders: 0,
  fuelDispensedToday: 0,
  weightAlerts: 0,
  complianceAlerts: 0,
};
