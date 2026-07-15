// ══════════════════════════════════════════════════════════════════
// TruckSphere Enterprise Type System
// All entities with full audit trails, status enums, and relationships
// ══════════════════════════════════════════════════════════════════

// ─── User Roles ───
export type UserRole =
  | 'admin'
  | 'management'
  | 'operator_quarry'
  | 'operator_site'
  | 'operator_fuel'
  | 'vendor';

// ─── Status Enums ───
export type VendorStatus = 'active' | 'inactive' | 'suspended';
export type DriverStatus = 'active' | 'inactive' | 'suspended' | 'on_trip';
export type VehicleStatus = 'active' | 'inactive' | 'on_trip' | 'in_maintenance' | 'out_of_service';
export type POStatus = 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'archived';
export type JobStatus =
  | 'draft'
  | 'assigned'
  | 'ready'
  | 'loading'
  | 'quarry_in'
  | 'quarry_out'
  | 'in_transit'
  | 'site_in'
  | 'offloading'
  | 'site_out'
  | 'receipt_uploaded'
  | 'reconciliation'
  | 'completed'
  | 'cancelled';
export type MaterialStatus = 'active' | 'inactive';
export type QuarryStatus = 'active' | 'inactive';
export type SiteStatus = 'active' | 'inactive';
export type FuelStationStatus = 'active' | 'inactive';

// ─── Audit Trail ───
export interface AuditTrail {
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  deletedBy?: string;
  deletedAt?: string;
}

// ─── User ───
export interface User extends AuditTrail {
  uid: string;
  email: string;
  displayName: string;
  name?: string;
  username?: string;
  role: UserRole;
  phone?: string;
  photoURL?: string;
  vendorId?: string;
  quarryId?: string;
  siteId?: string;
  fuelStationId?: string;
  employeeNumber?: string;
  shift?: string;
  isActive: boolean;
  lastLogin?: string;
}

// ─── Vendor ───
export interface Vendor extends AuditTrail {
  id: string;
  vendorId: string; // Auto-generated: V001, V002...
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  kraPin?: string;
  registrationNumber?: string;
  businessPermit?: string;
  companyActCR12?: string;
  fleetSize?: number;
  taxCompliance?: string;
  status: VendorStatus;
  // Computed
  driverCount?: number;
  vehicleCount?: number;
  activeJobCount?: number;
  performance?: VendorPerformance;
}

export interface VendorPerformance {
  totalJobs: number;
  completedJobs: number;
  onTimeRate: number; // percentage
  averageDeliveryTime: number; // hours
  weightVarianceRate: number; // percentage
  rating: number; // 1-5
}

// ─── Driver ───
export interface Driver extends AuditTrail {
  id: string;
  driverId: string; // Auto-generated: D001, D002...
  fullName: string;
  phone: string;
  email?: string;
  nationalId?: string;
  licenseNumber: string;
  licenseClass?: string;
  licenseExpiry: string;
  status: DriverStatus;
  photoURL?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  vendorId: string;
  vendorName?: string;
  assignedTruckId?: string;
  currentVehicleId?: string;
  currentVehiclePlate?: string;
  availability: boolean;
  totalTrips?: number;
  rating?: number;
  // Insurance
  insuranceCompany?: string;
  insuranceNumber?: string;
  insuranceStartDate?: string;
  insuranceExpiryDate?: string;
  insuranceCommencingDate?: string;
  insuranceSupplier?: string;
  // NTSE & WIBA
  ntsaInspectionExpiry?: string;
  wibaProvider?: string;
  wibaStartDate?: string;
  wibaEndDate?: string;
}

// ─── Vehicle ───
export interface Vehicle extends AuditTrail {
  id: string;
  registrationNumber: string; // Plate number
  plateNumber?: string;
  vendorId: string;
  vendorName?: string;
  make: string;
  model: string;
  year: number;
  capacity: number; // tonnes
  capacityUnit: string;
  assignedDriverId?: string;
  currentDriverId?: string;
  currentDriverName?: string;
  insuranceExpiry: string;
  inspectionExpiry: string;
  lastInspection?: string;
  status: VehicleStatus;
  photos?: string[];
  documents?: VehicleDocument[];
  axles?: number;
  fuelType?: string;
  color?: string;
}

export interface VehicleDocument {
  id: string;
  type: 'insurance' | 'inspection' | 'registration' | 'other';
  name: string;
  url: string;
  expiryDate?: string;
  uploadedAt: string;
}

// ─── Material Category ───
export type MaterialCategory =
  | 'Aggregates'
  | 'Steel'
  | 'Cement'
  | 'Liquid'
  | 'Blocks'
  | 'Other';

// ─── Measurement Unit ───
export type MeasurementUnit =
  | 'Tonnes'
  | 'Bags'
  | 'Pieces'
  | 'Millimetres'
  | 'Metres'
  | 'Litres'
  | 'Cubic Metres'
  | 'Kilograms';

// ─── Material Property Definition ───
export interface MaterialProperty {
  name: string;
  type: 'select' | 'number' | 'text' | 'boolean';
  label: string;
  required: boolean;
  options?: string[]; // For select type
  unit?: string;
}

// ─── Material ───
export interface Material extends AuditTrail {
  id: string;
  name: string;
  category: MaterialCategory;
  measurementType: MeasurementUnit;
  defaultUnit: string;
  status: MaterialStatus;
  description?: string;
  properties?: MaterialProperty[]; // Dynamic properties
  unitPrice?: number;
  // Computed
  standardWeight?: number; // e.g., 50kg per bag for cement
  diameterOptions?: string[]; // For steel: 8mm, 10mm, 12mm...
}

// ─── Quarry ───
export interface Quarry extends AuditTrail {
  id: string;
  name: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  status: QuarryStatus;
  contact?: string;
  phone?: string;
  email?: string;
  operatorId?: string;
  operatorName?: string;
}

// ─── Site ───
export interface Site extends AuditTrail {
  id: string;
  name: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  status: SiteStatus;
  contact?: string;
  phone?: string;
  email?: string;
  operatorId?: string;
  operatorName?: string;
}

// ─── Fuel Station ───
export interface FuelStation extends AuditTrail {
  id: string;
  name: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  status: FuelStationStatus;
  contact?: string;
  phone?: string;
  operatorId?: string;
  operatorName?: string;
}

// ─── Purchase Order ───
export interface PurchaseOrder extends AuditTrail {
  id: string;
  poNumber: string; // Auto-generated: POMAT###/V###
  customerId?: string;
  customerName?: string;
  vendorId: string;
  vendorName: string;
  companyName?: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalAmount?: number;
  expectedCompletion?: string;
  status: POStatus;
  quarryId?: string;
  quarryName?: string;
  siteId?: string;
  siteName?: string;
  notes?: string;
  // Workflow
  approvedBy?: string;
  approvedAt?: string;
  jobCount?: number;
  deliveredQuantity?: number;
  quantityDelivered?: number; // Alias for deliveredQuantity
  remainingQuantity?: number;
}

// ─── Job (Delivery Order) ───
export interface Job extends AuditTrail {
  id: string;
  jobId: string; // Auto-generated: POMAT###/V###/D###/T###/J####
  documentId?: string;
  purchaseOrderId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  companyName?: string;
  driverId: string;
  driverName: string;
  driverPhotoURL?: string;
  vehicleId: string;
  plateNumber: string;
  materialId: string;
  materialName: string;
  materialSource?: string;
  quantityOrdered: number;
  quantityDispatched?: number;
  quantityDelivered?: number;
  unit: string;
  quarryId?: string;
  quarryName?: string;
  siteId?: string;
  siteName?: string;
  status: JobStatus;
  trackingId?: string;
  // Weights
  weighInId?: string;
  weighOutId?: string;
  weighInWeight?: number;
  weighOutWeight?: number;
  netWeight?: number;
  siteWeighInWeight?: number;
  siteWeighOutWeight?: number;
  siteNetWeight?: number;
  weightVariance?: number;
  weighInAt?: string;
  weighOutAt?: string;
  siteWeighInAt?: string;
  siteWeighOutAt?: string;
  weighInLocation?: string;
  weighOutLocation?: string;
  weighOutGeoLocation?: string;
  // Timeline
  dispatchTime?: string;
  quarryInTime?: string;
  quarryOutTime?: string;
  siteInTime?: string;
  siteOutTime?: string;
  receiptTime?: string;
  completionTime?: string;
  // Receipt
  receiptNoteId?: string;
  receiptPhotoURL?: string;
  // Fuel
  fuelRecordId?: string;
  fuelAmount?: number;
  // Flags
  isDelayed: boolean;
  hasWeightDiscrepancy: boolean;
}

// ─── Weigh Record ───
export interface WeighRecord extends AuditTrail {
  id: string;
  jobId: string;
  deliveryOrderId: string;
  type: 'weigh_in' | 'weigh_out';
  weight: number;
  unit: string;
  location: string;
  latitude: number;
  longitude: number;
  photoURL?: string;
  operatorId: string;
  operatorName: string;
  notes?: string;
  timestamp: string;
}

// ─── Checkpoint ───
export interface Checkpoint extends AuditTrail {
  id: string;
  jobId: string;
  deliveryOrderId: string;
  type: string;
  timestamp: string;
  location: string;
  notes?: string;
  weight?: number;
  photoURL?: string;
}

// ─── Fuel Record ───
export interface FuelRecord extends AuditTrail {
  id: string;
  fuelId: string;
  jobId: string;
  vendorId: string;
  vendorName: string;
  companyName?: string;
  driverName: string;
  plateNumber: string;
  fuelAmount: number;
  fuelType?: string;
  unit: string;
  pricePerUnit?: number;
  totalCost?: number;
  stationId: string;
  stationName: string;
  operatorId: string;
  operatorName: string;
  authorizationCode?: string;
  authorizationId?: string;
  dispensedAt: string;
  notes?: string;
}

// ─── Fuel Authorization ───
export interface FuelAuthorization extends AuditTrail {
  id: string;
  jobId: string;
  vendorId: string;
  fuelAmount: number;
  otp: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  authorizedBy?: string;
  authorizedAt?: string;
  expiresAt: string;
}

// ─── Customer ───
export interface Customer extends AuditTrail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  kraPin?: string;
  status: 'active' | 'inactive';
}

// ─── Audit Log Entry ───
export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  details: string;
  changes?: Record<string, { from: any; to: any }>;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

// ─── Dashboard Stats ───
export interface DashboardStats {
  todayJobs: number;
  activeDeliveries: number;
  delayedJobs: number;
  pendingDispatch: number;
  activeVehicles: number;
  availableDrivers: number;
  totalVendors: number;
  totalDrivers: number;
  totalVehicles: number;
  todayDeliveries: number;
  pendingOrders: number;
  fuelDispensedToday: number;
  weightAlerts: number;
  complianceAlerts: number;
}

// ─── Activity Log Entry ───
export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  userName: string;
  timestamp: string;
  icon?: string;
  color?: string;
}

// ─── Role & Permission ───
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
}

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'approve' | 'archive')[];
}

// ─── Master Data Summary ───
export interface MasterDataSummary {
  key: string;
  label: string;
  total: number;
  active: number;
  inactive: number;
  icon: string;
  route: string;
}

// ─── Auth State ───
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ─── Tab Config ───
export interface TabConfig {
  name: string;
  label: string;
  icon: string;
}

// ─── Search Result ───
export interface SearchResult {
  id: string;
  type: 'vendor' | 'driver' | 'vehicle' | 'material' | 'purchase_order' | 'job';
  label: string;
  subtitle: string;
  route: string;
  icon: string;
  color: string;
}

// ─── Filter Config ───
export interface FilterOption {
  key: string;
  label: string;
  icon?: string;
}

export interface FilterState {
  dateRange?: { start: string; end: string };
  vendorId?: string;
  driverId?: string;
  vehicleId?: string;
  materialId?: string;
  purchaseOrderId?: string;
  status?: string;
  quarryId?: string;
  siteId?: string;
  search?: string;
}
