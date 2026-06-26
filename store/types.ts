export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  photoURL?: string;
  vendorId?: string;
  quarryId?: string;
  siteId?: string;
  createdAt: string;
}

export type UserRole = 'management' | 'operator_quarry' | 'operator_site' | 'vendor';

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  status: 'active' | 'inactive';
  fleetSize: number;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: 'active' | 'inactive' | 'suspended';
  vendorId?: string;
  assignedTruckId?: string;
  photoURL?: string;
  totalTrips?: number;
  rating?: number;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  make: string;
  year: number;
  color: string;
  capacity: number; // tons
  status: 'active' | 'in_maintenance' | 'out_of_service';
  vendorId?: string;
  assignedDriverId?: string;
  insuranceExpiry: string;
  lastInspection: string;
  createdAt: string;
}

export interface Material {
  id: string;
  name: string;
  description?: string;
  unit: string;
  unitPrice: number;
  category: string;
  active: boolean;
}

export interface Quarry {
  id: string;
  name: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  status: 'active' | 'inactive';
  contact?: string;
  createdAt: string;
}

export interface Site {
  id: string;
  name: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  status: 'active' | 'inactive';
  contact?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  quarryId: string;
  quarryName: string;
  siteId: string;
  siteName: string;
  requestedBy: string;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryOrder {
  id: string;
  jobId: string;
  purchaseOrderId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  plateNumber: string;
  materialId: string;
  materialName: string;
  quantityOrdered: number;
  quantityDelivered: number;
  quarryId: string;
  quarryName: string;
  siteId: string;
  siteName: string;
  status: 'assigned' | 'in_transit' | 'at_quarry' | 'loaded' | 'in_transit_to_site' | 'delivered' | 'cancelled';
  weighInId?: string;
  weighOutId?: string;
  weighInWeight?: number;
  weighOutWeight?: number;
  netWeight?: number;
  weighInAt?: string;
  weighOutAt?: string;
  weighInLocation?: string;
  weighOutLocation?: string;
  weighInPhoto?: string;
  weighOutPhoto?: string;
  receivedAt?: string;
  receivedLocation?: string;
  receivedBy?: string;
  deliveredAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeighRecord {
  id: string;
  deliveryOrderId: string;
  jobId: string;
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

export interface QuarryQueue {
  id: string;
  position: number;
  deliveryOrderId: string;
  jobId: string;
  driverName: string;
  plateNumber: string;
  materialName: string;
  status: 'waiting' | 'weighing_in' | 'loading' | 'weighing_out' | 'completed';
  arrivedAt: string;
  weighInAt?: string;
  weighOutAt?: string;
}

export interface SiteDelivery {
  id: string;
  deliveryOrderId: string;
  jobId: string;
  vendorName: string;
  driverName: string;
  plateNumber: string;
  materialName: string;
  quantity: number;
  status: 'scheduled' | 'in_transit' | 'arrived' | 'received' | 'confirmed';
  scheduledAt: string;
  arrivedAt?: string;
  receivedAt?: string;
}

export interface DashboardStats {
  activeTrucks: number;
  pendingDeliveries: number;
  todayWeighments: number;
  todayDeliveries: number;
  activeDrivers: number;
  pendingOrders: number;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface Checkpoint {
  id: string;
  deliveryOrderId: string;
  jobId: string;
  type: 'weigh_in' | 'weigh_out' | 'loading' | 'in_transit' | 'arrived_site' | 'received';
  timestamp: string;
  location: string;
  notes?: string;
}

export type TabName = string;
