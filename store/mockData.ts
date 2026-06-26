// Mock data store for the truck-app
// This simulates Firebase/Firestore data for development

import {
  Driver,
  Vehicle,
  Material,
  PurchaseOrder,
  DeliveryOrder,
  WeighRecord,
  QuarryQueue,
  SiteDelivery,
  DashboardStats,
} from './types';

const DATA: {
  drivers: Driver[];
  vehicles: Vehicle[];
  materials: Material[];
  purchaseOrders: PurchaseOrder[];
  deliveryOrders: DeliveryOrder[];
  weighRecords: WeighRecord[];
  quarryQueue: QuarryQueue[];
  siteDeliveries: SiteDelivery[];
  dashboardStats: DashboardStats;
} = {
  drivers: [
    { id: 'd1', name: 'David Mwangi', phone: '+254712345678', email: 'david@example.com', licenseNumber: 'L12345', licenseExpiry: '2026-12-31', status: 'active', vendorId: 'v1', assignedTruckId: 't1', createdAt: '2025-01-15T08:00:00Z' },
    { id: 'd2', name: 'Sarah Wanjiku', phone: '+254723456789', email: 'sarah@example.com', licenseNumber: 'L12346', licenseExpiry: '2026-11-30', status: 'active', vendorId: 'v1', assignedTruckId: 't2', createdAt: '2025-02-20T09:00:00Z' },
    { id: 'd3', name: 'James Ochieng', phone: '+254734567890', email: 'james@example.com', licenseNumber: 'L12347', licenseExpiry: '2026-10-15', status: 'active', vendorId: 'v2', assignedTruckId: 't3', createdAt: '2025-03-10T10:00:00Z' },
    { id: 'd4', name: 'Grace Akinyi', phone: '+254745678901', email: 'grace@example.com', licenseNumber: 'L12348', licenseExpiry: '2026-09-20', status: 'inactive', vendorId: 'v2', createdAt: '2025-04-05T11:00:00Z' },
    { id: 'd5', name: 'Peter Kamau', phone: '+254756789012', email: 'peter@example.com', licenseNumber: 'L12349', licenseExpiry: '2026-08-01', status: 'active', vendorId: 'v1', assignedTruckId: 't4', createdAt: '2025-05-12T12:00:00Z' },
    { id: 'd6', name: 'Mary Njoroge', phone: '+254767890123', email: 'mary@example.com', licenseNumber: 'L12350', licenseExpiry: '2025-07-15', status: 'suspended', vendorId: 'v3', createdAt: '2025-06-01T13:00:00Z' },
  ],

  vehicles: [
    { id: 't1', plateNumber: 'KCA 123A', model: 'FH 460', make: 'Volvo', year: 2023, color: 'White', capacity: 40, status: 'active', vendorId: 'v1', assignedDriverId: 'd1', insuranceExpiry: '2026-06-30', lastInspection: '2025-12-15', createdAt: '2025-01-10T08:00:00Z' },
    { id: 't2', plateNumber: 'KCB 456B', model: 'Actros 3348', make: 'Mercedes-Benz', year: 2022, color: 'Blue', capacity: 38, status: 'active', vendorId: 'v1', assignedDriverId: 'd2', insuranceExpiry: '2026-05-20', lastInspection: '2025-11-20', createdAt: '2025-02-15T09:00:00Z' },
    { id: 't3', plateNumber: 'KCC 789C', model: 'TGX 26.480', make: 'MAN', year: 2023, color: 'Red', capacity: 42, status: 'active', vendorId: 'v2', assignedDriverId: 'd3', insuranceExpiry: '2026-07-10', lastInspection: '2025-12-01', createdAt: '2025-03-20T10:00:00Z' },
    { id: 't4', plateNumber: 'KCD 012D', model: 'FMX 440', make: 'Volvo', year: 2021, color: 'Silver', capacity: 36, status: 'in_maintenance', vendorId: 'v1', assignedDriverId: 'd5', insuranceExpiry: '2026-04-15', lastInspection: '2025-10-05', createdAt: '2025-04-25T11:00:00Z' },
    { id: 't5', plateNumber: 'KCE 345E', model: 'Dumper FMX', make: 'Volvo', year: 2024, color: 'Yellow', capacity: 45, status: 'active', vendorId: 'v3', insuranceExpiry: '2027-01-20', lastInspection: '2026-01-10', createdAt: '2025-07-01T12:00:00Z' },
  ],

  materials: [
    { id: 'm1', name: 'Ballast 3/4', description: 'Crushed stone 3/4 inch', unit: 'tonnes', unitPrice: 1800, category: 'aggregates', active: true },
    { id: 'm2', name: 'Ballast 1/2', description: 'Crushed stone 1/2 inch', unit: 'tonnes', unitPrice: 1900, category: 'aggregates', active: true },
    { id: 'm3', name: 'Sand (River)', description: 'Natural river sand', unit: 'tonnes', unitPrice: 1500, category: 'sand', active: true },
    { id: 'm4', name: 'Sand (Quarry)', description: 'Quarry dust / Manufactured sand', unit: 'tonnes', unitPrice: 1300, category: 'sand', active: true },
    { id: 'm5', name: 'Hardcore', description: 'Large stones for foundation', unit: 'tonnes', unitPrice: 1200, category: 'aggregates', active: true },
    { id: 'm6', name: 'Murram', description: 'Laterite soil for grading', unit: 'tonnes', unitPrice: 800, category: 'earth', active: true },
    { id: 'm7', name: 'Cement (Portland)', description: 'Portland cement 50kg bags', unit: 'bags', unitPrice: 650, category: 'cement', active: true },
  ],

  purchaseOrders: [
    { id: 'po1', poNumber: 'PO-2025-001', vendorId: 'v1', vendorName: 'Mwangi Transport Ltd', materialId: 'm1', materialName: 'Ballast 3/4', quantity: 200, unit: 'tonnes', unitPrice: 1800, totalAmount: 360000, status: 'approved', quarryId: 'q1', quarryName: 'Kisumu Quarry', siteId: 's1', siteName: 'City Centre Site B', requestedBy: 'u1', approvedBy: 'u2', createdAt: '2025-06-01T08:00:00Z', updatedAt: '2025-06-02T10:00:00Z' },
    { id: 'po2', poNumber: 'PO-2025-002', vendorId: 'v1', vendorName: 'Mwangi Transport Ltd', materialId: 'm3', materialName: 'Sand (River)', quantity: 150, unit: 'tonnes', unitPrice: 1500, totalAmount: 225000, status: 'in_progress', quarryId: 'q2', quarryName: 'River Sand Quarry', siteId: 's1', siteName: 'City Centre Site B', requestedBy: 'u1', notes: 'Urgent - needed for foundation', createdAt: '2025-06-10T09:00:00Z', updatedAt: '2025-06-11T11:00:00Z' },
    { id: 'po3', poNumber: 'PO-2025-003', vendorId: 'v2', vendorName: 'Kamau Trucking Co', materialId: 'm2', materialName: 'Ballast 1/2', quantity: 100, unit: 'tonnes', unitPrice: 1900, totalAmount: 190000, status: 'pending', quarryId: 'q1', quarryName: 'Kisumu Quarry', siteId: 's2', siteName: 'Westlands Tower', requestedBy: 'u3', createdAt: '2025-06-15T10:00:00Z', updatedAt: '2025-06-15T10:00:00Z' },
    { id: 'po4', poNumber: 'PO-2025-004', vendorId: 'v3', vendorName: 'Ochieng Supplies', materialId: 'm5', materialName: 'Hardcore', quantity: 80, unit: 'tonnes', unitPrice: 1200, totalAmount: 96000, status: 'completed', quarryId: 'q1', quarryName: 'Kisumu Quarry', siteId: 's3', siteName: 'Eastlands Estate', requestedBy: 'u1', approvedBy: 'u2', createdAt: '2025-05-20T08:00:00Z', updatedAt: '2025-06-05T16:00:00Z' },
    { id: 'po5', poNumber: 'PO-2025-005', vendorId: 'v1', vendorName: 'Mwangi Transport Ltd', materialId: 'm7', materialName: 'Cement (Portland)', quantity: 500, unit: 'bags', unitPrice: 650, totalAmount: 325000, status: 'pending', quarryId: 'q3', quarryName: 'Cement Depot', siteId: 's1', siteName: 'City Centre Site B', requestedBy: 'u3', createdAt: '2025-06-18T14:00:00Z', updatedAt: '2025-06-18T14:00:00Z' },
  ],

  deliveryOrders: [
    { id: 'do1', jobId: 'JOB-2025-0001', purchaseOrderId: 'po1', poNumber: 'PO-2025-001', vendorId: 'v1', vendorName: 'Mwangi Transport Ltd', driverId: 'd1', driverName: 'David Mwangi', vehicleId: 't1', plateNumber: 'KCA 123A', materialId: 'm1', materialName: 'Ballast 3/4', quantityOrdered: 20, quantityDelivered: 0, quarryId: 'q1', quarryName: 'Kisumu Quarry', siteId: 's1', siteName: 'City Centre Site B', status: 'at_quarry', weighInWeight: 42.5, weighInAt: '2025-06-20T08:30:00Z', weighInLocation: 'Kisumu Quarry Gate', createdBy: 'u1', createdAt: '2025-06-19T10:00:00Z', updatedAt: '2025-06-20T08:30:00Z' },
    { id: 'do2', jobId: 'JOB-2025-0002', purchaseOrderId: 'po1', poNumber: 'PO-2025-001', vendorId: 'v1', vendorName: 'Mwangi Transport Ltd', driverId: 'd2', driverName: 'Sarah Wanjiku', vehicleId: 't2', plateNumber: 'KCB 456B', materialId: 'm1', materialName: 'Ballast 3/4', quantityOrdered: 20, quantityDelivered: 20, quarryId: 'q1', quarryName: 'Kisumu Quarry', siteId: 's1', siteName: 'City Centre Site B', status: 'delivered', weighInWeight: 40.2, weighOutWeight: 18.5, netWeight: 21.7, weighInAt: '2025-06-19T08:00:00Z', weighOutAt: '2025-06-19T09:15:00Z', weighInLocation: 'Kisumu Quarry Gate', weighOutLocation: 'Kisumu Quarry Exit', deliveredAt: '2025-06-19T11:30:00Z', receivedAt: '2025-06-19T11:30:00Z', receivedLocation: 'City Centre Site B', receivedBy: 'Anna Site', createdBy: 'u1', createdAt: '2025-06-18T10:00:00Z', updatedAt: '2025-06-19T11:30:00Z' },
    { id: 'do3', jobId: 'JOB-2025-0003', purchaseOrderId: 'po2', poNumber: 'PO-2025-002', vendorId: 'v1', vendorName: 'Mwangi Transport Ltd', driverId: 'd5', driverName: 'Peter Kamau', vehicleId: 't4', plateNumber: 'KCD 012D', materialId: 'm3', materialName: 'Sand (River)', quantityOrdered: 20, quantityDelivered: 0, quarryId: 'q2', quarryName: 'River Sand Quarry', siteId: 's1', siteName: 'City Centre Site B', status: 'assigned', createdBy: 'u1', createdAt: '2025-06-18T11:00:00Z', updatedAt: '2025-06-18T11:00:00Z' },
    { id: 'do4', jobId: 'JOB-2025-0004', purchaseOrderId: 'po4', poNumber: 'PO-2025-004', vendorId: 'v3', vendorName: 'Ochieng Supplies', driverId: 'd3', driverName: 'James Ochieng', vehicleId: 't3', plateNumber: 'KCC 789C', materialId: 'm5', materialName: 'Hardcore', quantityOrdered: 20, quantityDelivered: 20, quarryId: 'q1', quarryName: 'Kisumu Quarry', siteId: 's3', siteName: 'Eastlands Estate', status: 'delivered', weighInWeight: 44.0, weighOutWeight: 22.3, netWeight: 21.7, weighInAt: '2025-06-05T07:00:00Z', weighOutAt: '2025-06-05T08:30:00Z', deliveredAt: '2025-06-05T10:00:00Z', receivedAt: '2025-06-05T10:00:00Z', receivedBy: 'Site Manager', createdBy: 'u1', createdAt: '2025-06-04T10:00:00Z', updatedAt: '2025-06-05T10:00:00Z' },
  ],

  weighRecords: [
    { id: 'w1', deliveryOrderId: 'do1', jobId: 'JOB-2025-0001', type: 'weigh_in', weight: 42.5, unit: 'tonnes', location: 'Kisumu Quarry Gate', latitude: -0.0917, longitude: 34.7680, operatorId: 'op1', operatorName: 'Peter Quarry', timestamp: '2025-06-20T08:30:00Z' },
    { id: 'w2', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'weigh_in', weight: 40.2, unit: 'tonnes', location: 'Kisumu Quarry Gate', latitude: -0.0917, longitude: 34.7680, operatorId: 'op1', operatorName: 'Peter Quarry', timestamp: '2025-06-19T08:00:00Z' },
    { id: 'w3', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'weigh_out', weight: 18.5, unit: 'tonnes', location: 'Kisumu Quarry Exit', latitude: -0.0918, longitude: 34.7682, operatorId: 'op1', operatorName: 'Peter Quarry', timestamp: '2025-06-19T09:15:00Z' },
    { id: 'w4', deliveryOrderId: 'do4', jobId: 'JOB-2025-0004', type: 'weigh_in', weight: 44.0, unit: 'tonnes', location: 'Kisumu Quarry Gate', latitude: -0.0917, longitude: 34.7680, operatorId: 'op1', operatorName: 'Peter Quarry', timestamp: '2025-06-05T07:00:00Z' },
    { id: 'w5', deliveryOrderId: 'do4', jobId: 'JOB-2025-0004', type: 'weigh_out', weight: 22.3, unit: 'tonnes', location: 'Kisumu Quarry Exit', latitude: -0.0918, longitude: 34.7682, operatorId: 'op1', operatorName: 'Peter Quarry', timestamp: '2025-06-05T08:30:00Z' },
  ],

  quarryQueue: [
    { id: 'qq1', position: 1, deliveryOrderId: 'do1', jobId: 'JOB-2025-0001', driverName: 'David Mwangi', plateNumber: 'KCA 123A', materialName: 'Ballast 3/4', status: 'weighing_in', arrivedAt: '2025-06-20T08:00:00Z' },
    { id: 'qq2', position: 2, deliveryOrderId: 'do3', jobId: 'JOB-2025-0003', driverName: 'Peter Kamau', plateNumber: 'KCD 012D', materialName: 'Sand (River)', status: 'waiting', arrivedAt: '2025-06-20T08:15:00Z' },
  ],

  siteDeliveries: [
    { id: 'sd1', deliveryOrderId: 'do1', jobId: 'JOB-2025-0001', vendorName: 'Mwangi Transport Ltd', driverName: 'David Mwangi', plateNumber: 'KCA 123A', materialName: 'Ballast 3/4', quantity: 20, status: 'in_transit', scheduledAt: '2025-06-20T10:00:00Z' },
    { id: 'sd2', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', vendorName: 'Mwangi Transport Ltd', driverName: 'Sarah Wanjiku', plateNumber: 'KCB 456B', materialName: 'Ballast 3/4', quantity: 20, status: 'received', scheduledAt: '2025-06-19T10:00:00Z', arrivedAt: '2025-06-19T11:00:00Z', receivedAt: '2025-06-19T11:30:00Z' },
  ],

  dashboardStats: {
    activeTrucks: 4,
    pendingDeliveries: 6,
    todayWeighments: 12,
    todayDeliveries: 8,
    activeDrivers: 4,
    pendingOrders: 3,
  },
};

// Named exports for direct import
export const MOCK_DRIVERS = DATA.drivers;
export const MOCK_VEHICLES = DATA.vehicles;
export const MOCK_TRUCKS = DATA.vehicles;
export const MOCK_MATERIALS = DATA.materials;
export const MOCK_PURCHASE_ORDERS = DATA.purchaseOrders;
export const MOCK_ORDERS = DATA.purchaseOrders;
export const MOCK_DELIVERY_ORDERS = DATA.deliveryOrders;
export const MOCK_DELIVERIES = DATA.deliveryOrders;
export const MOCK_WEIGHMENTS = DATA.weighRecords;
export const MOCK_QUARRY_QUEUE = DATA.quarryQueue;
export const MOCK_SITE_DELIVERIES = DATA.siteDeliveries;
export const MOCK_DASHBOARD_STATS = DATA.dashboardStats;

export const MOCK_DATA = DATA;
