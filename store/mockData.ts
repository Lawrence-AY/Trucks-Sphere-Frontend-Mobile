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
  DeliveryOrder,
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
export const MOCK_DELIVERY_ORDERS: DeliveryOrder[] = [];
export const MOCK_WEIGHMENTS: WeighRecord[] = [];

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  activeTrucks: 0,
  pendingDeliveries: 0,
  todayWeighments: 0,
  todayDeliveries: 0,
  activeDrivers: 0,
  pendingOrders: 0,
};