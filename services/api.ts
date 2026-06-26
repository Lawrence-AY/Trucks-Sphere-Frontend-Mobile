import { useAuthStore } from '../store/authStore';
import { getStoredToken } from './database';
import {
  MOCK_DRIVERS, MOCK_TRUCKS, MOCK_MATERIALS,
  MOCK_PURCHASE_ORDERS, MOCK_DELIVERY_ORDERS, MOCK_WEIGHMENTS,
  MOCK_DASHBOARD_STATS,
} from '../store/mockData';
// Mock vendors (inline — not exported from mockData)
const MOCK_VENDORS: any[] = [
  { id: 'v1', name: 'Mwangi Transport Ltd', phone: '+254712345601', email: 'info@mwangi.co.ke', address: 'Nairobi Industrial Area', status: 'active', fleetSize: 4, createdAt: '2025-01-10T08:00:00Z' },
  { id: 'v2', name: 'Kamau Trucking Co', phone: '+254712345602', email: 'info@kamauco.ke', address: 'Mombasa Road', status: 'active', fleetSize: 3, createdAt: '2025-02-15T09:00:00Z' },
  { id: 'v3', name: 'Ochieng Supplies Ltd', phone: '+254712345603', email: 'info@ochieng.co.ke', address: 'Kisumu Industrial Park', status: 'active', fleetSize: 2, createdAt: '2025-03-20T10:00:00Z' },
  { id: 'v4', name: 'Njoroge Heavy Haulage', phone: '+254712345604', email: 'info@njoroge.co.ke', address: 'Thika Road', status: 'active', fleetSize: 5, createdAt: '2025-04-10T11:00:00Z' },
  { id: 'v5', name: 'Wanjiku Logistics', phone: '+254712345605', email: 'info@wanjikulogistics.co.ke', address: 'Nakuru Highway', status: 'inactive', fleetSize: 1, createdAt: '2025-05-05T12:00:00Z' },
];

// Base URL for backend API
const API_BASE = 'http://localhost:3000/api';

// Checkpoint type in mock data
interface Checkpoint {
  id: string;
  deliveryOrderId: string;
  jobId: string;
  type: string;
  timestamp: string;
  location: string;
  notes?: string;
}

// Mock checkpoints (from seed data)
const MOCK_CHECKPOINTS: Checkpoint[] = [
  { id: 'cp-do1-0', deliveryOrderId: 'do1', jobId: 'JOB-2025-0001', type: 'origin', timestamp: '2025-06-25T06:00:00Z', location: 'Mwangi Yard, Nairobi', notes: 'Departed yard' },
  { id: 'cp-do1-1', deliveryOrderId: 'do1', jobId: 'JOB-2025-0001', type: 'weigh_in', timestamp: '2025-06-25T07:30:00Z', location: 'Quarry Gate', notes: 'Weigh-in completed' },
  { id: 'cp-do1-2', deliveryOrderId: 'do1', jobId: 'JOB-2025-0001', type: 'loading', timestamp: '2025-06-25T08:30:00Z', location: 'Quarry Loading Bay', notes: 'Loading in progress' },
  { id: 'cp-do2-0', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'origin', timestamp: '2025-06-19T06:30:00Z', location: 'Mwangi Yard, Nairobi', notes: 'Departed yard' },
  { id: 'cp-do2-1', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'weigh_in', timestamp: '2025-06-19T08:00:00Z', location: 'Quarry Gate', notes: 'Weigh-in completed' },
  { id: 'cp-do2-2', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'loading', timestamp: '2025-06-19T08:45:00Z', location: 'Quarry Loading Bay', notes: 'Loading completed' },
  { id: 'cp-do2-3', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'weigh_out', timestamp: '2025-06-19T09:15:00Z', location: 'Quarry Exit', notes: 'Weigh-out completed' },
  { id: 'cp-do2-4', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'in_transit', timestamp: '2025-06-19T09:30:00Z', location: 'En route to site', notes: 'Departing quarry' },
  { id: 'cp-do2-5', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'arrived_site', timestamp: '2025-06-19T11:00:00Z', location: 'City Centre Site B', notes: 'Arrived at site' },
  { id: 'cp-do2-6', deliveryOrderId: 'do2', jobId: 'JOB-2025-0002', type: 'received', timestamp: '2025-06-19T11:30:00Z', location: 'City Centre Site B', notes: 'Received by site operator' },
  { id: 'cp-do4-1', deliveryOrderId: 'do4', jobId: 'JOB-2025-0004', type: 'weigh_in', timestamp: '2025-06-05T07:00:00Z', location: 'Quarry Gate', notes: 'Weigh-in' },
  { id: 'cp-do4-2', deliveryOrderId: 'do4', jobId: 'JOB-2025-0004', type: 'loading', timestamp: '2025-06-05T07:45:00Z', location: 'Quarry Loading Bay', notes: 'Loaded' },
  { id: 'cp-do4-3', deliveryOrderId: 'do4', jobId: 'JOB-2025-0004', type: 'weigh_out', timestamp: '2025-06-05T08:30:00Z', location: 'Quarry Exit', notes: 'Weigh-out' },
  { id: 'cp-do4-4', deliveryOrderId: 'do4', jobId: 'JOB-2025-0004', type: 'in_transit', timestamp: '2025-06-05T08:45:00Z', location: 'En route', notes: 'To site' },
  { id: 'cp-do4-5', deliveryOrderId: 'do4', jobId: 'JOB-2025-0004', type: 'arrived_site', timestamp: '2025-06-05T09:30:00Z', location: 'Eastlands Estate', notes: 'Arrived' },
  { id: 'cp-do4-6', deliveryOrderId: 'do4', jobId: 'JOB-2025-0004', type: 'received', timestamp: '2025-06-05T10:00:00Z', location: 'Eastlands Estate', notes: 'Received' },
  { id: 'cp-do5-1', deliveryOrderId: 'do5', jobId: 'JOB-2025-0005', type: 'weigh_in', timestamp: '2025-06-17T07:00:00Z', location: 'Quarry Gate', notes: '' },
  { id: 'cp-do5-2', deliveryOrderId: 'do5', jobId: 'JOB-2025-0005', type: 'loading', timestamp: '2025-06-17T07:40:00Z', location: 'Loading Bay', notes: '' },
  { id: 'cp-do5-3', deliveryOrderId: 'do5', jobId: 'JOB-2025-0005', type: 'weigh_out', timestamp: '2025-06-17T08:20:00Z', location: 'Quarry Exit', notes: '' },
  { id: 'cp-do5-4', deliveryOrderId: 'do5', jobId: 'JOB-2025-0005', type: 'in_transit', timestamp: '2025-06-17T08:30:00Z', location: 'En route', notes: '' },
  { id: 'cp-do5-5', deliveryOrderId: 'do5', jobId: 'JOB-2025-0005', type: 'arrived_site', timestamp: '2025-06-17T10:00:00Z', location: 'City Centre Site B', notes: '' },
  { id: 'cp-do5-6', deliveryOrderId: 'do5', jobId: 'JOB-2025-0005', type: 'received', timestamp: '2025-06-17T10:15:00Z', location: 'City Centre Site B', notes: '' },
  { id: 'cp-do7-0', deliveryOrderId: 'do7', jobId: 'JOB-2025-0007', type: 'origin', timestamp: '2025-06-25T06:00:00Z', location: 'Ochieng Depot, Kisumu', notes: 'Departed depot' },
  { id: 'cp-do7-1', deliveryOrderId: 'do7', jobId: 'JOB-2025-0007', type: 'weigh_in', timestamp: '2025-06-25T07:30:00Z', location: 'Nairobi Quarry Gate', notes: '' },
  { id: 'cp-do7-2', deliveryOrderId: 'do7', jobId: 'JOB-2025-0007', type: 'loading', timestamp: '2025-06-25T08:00:00Z', location: 'Nairobi Quarry', notes: 'Loading' },
  { id: 'cp-do8-0', deliveryOrderId: 'do8', jobId: 'JOB-2025-0008', type: 'origin', timestamp: '2025-06-25T06:30:00Z', location: 'Mwangi Yard, Nairobi', notes: 'Departed yard' },
  { id: 'cp-do8-1', deliveryOrderId: 'do8', jobId: 'JOB-2025-0008', type: 'weigh_in', timestamp: '2025-06-25T08:00:00Z', location: 'Nairobi Quarry Gate', notes: '' },
  { id: 'cp-do8-2', deliveryOrderId: 'do8', jobId: 'JOB-2025-0008', type: 'loading', timestamp: '2025-06-25T08:30:00Z', location: 'Nairobi Quarry', notes: '' },
  { id: 'cp-do8-3', deliveryOrderId: 'do8', jobId: 'JOB-2025-0008', type: 'weigh_out', timestamp: '2025-06-25T09:00:00Z', location: 'Nairobi Quarry Exit', notes: '' },
  { id: 'cp-do8-4', deliveryOrderId: 'do8', jobId: 'JOB-2025-0008', type: 'in_transit', timestamp: '2025-06-25T09:15:00Z', location: 'En route to Tatu City', notes: '' },
];

// Mock vendors extended
const MOCK_VENDORS_FULL = [
  { id: 'v1', name: 'Mwangi Transport Ltd', phone: '+254712345601', email: 'info@mwangi.co.ke', address: 'Nairobi Industrial Area', status: 'active', fleetSize: 4, createdAt: '2025-01-10T08:00:00Z' },
  { id: 'v2', name: 'Kamau Trucking Co', phone: '+254712345602', email: 'info@kamauco.ke', address: 'Mombasa Road', status: 'active', fleetSize: 3, createdAt: '2025-02-15T09:00:00Z' },
  { id: 'v3', name: 'Ochieng Supplies Ltd', phone: '+254712345603', email: 'info@ochieng.co.ke', address: 'Kisumu Industrial Park', status: 'active', fleetSize: 2, createdAt: '2025-03-20T10:00:00Z' },
  { id: 'v4', name: 'Njoroge Heavy Haulage', phone: '+254712345604', email: 'info@njoroge.co.ke', address: 'Thika Road', status: 'active', fleetSize: 5, createdAt: '2025-04-10T11:00:00Z' },
  { id: 'v5', name: 'Wanjiku Logistics', phone: '+254712345605', email: 'info@wanjikulogistics.co.ke', address: 'Nakuru Highway', status: 'inactive', fleetSize: 1, createdAt: '2025-05-05T12:00:00Z' },
];

// ============== API Utility ==============

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = useAuthStore.getState().user?.uid || (await getStoredToken()) || undefined;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchFromApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const headers = await getAuthHeaders();
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, { method: 'GET', headers });
  if (res.status === 401) useAuthStore.getState().logout();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // API returns { data, total, page, totalPages } or direct array
  if (json && json.data) return json.data as T;
  return json as T;
}

async function tryFetch<T>(endpoint: string, params: Record<string, string> | undefined, fallback: T): Promise<T> {
  try {
    const result = await fetchFromApi<T>(endpoint, params);
    return result;
  } catch (e) {
    console.warn(`API fetch failed for ${endpoint}, using mock fallback:`, e);
    return fallback;
  }
}

// ============== Fetch Functions ==============

export async function fetchVendors(params?: { search?: string; status?: string }): Promise<any[]> {
  return tryFetch('/vendors', params as Record<string, string>, MOCK_VENDORS_FULL);
}

export async function fetchDrivers(params?: { search?: string; status?: string }): Promise<any[]> {
  return tryFetch('/drivers', params as Record<string, string>, MOCK_DRIVERS as any[]);
}

export async function fetchVehicles(params?: { search?: string; status?: string }): Promise<any[]> {
  return tryFetch('/vehicles', params as Record<string, string>, MOCK_TRUCKS as any[]);
}

export async function fetchMaterials(params?: { search?: string; category?: string }): Promise<any[]> {
  return tryFetch('/materials', params as Record<string, string>, MOCK_MATERIALS as any[]);
}

export async function fetchPurchaseOrders(params?: { search?: string; status?: string }): Promise<any[]> {
  return tryFetch('/purchase-orders', params as Record<string, string>, MOCK_PURCHASE_ORDERS as any[]);
}

export async function fetchDeliveryOrders(params?: { search?: string; status?: string; jobId?: string; purchaseOrderId?: string }): Promise<any[]> {
  return tryFetch('/delivery-orders', params as Record<string, string>, MOCK_DELIVERY_ORDERS as any[]);
}

export async function fetchWeighments(params?: { jobId?: string; type?: string }): Promise<any[]> {
  return tryFetch('/weighbridge', params as Record<string, string>, MOCK_WEIGHMENTS as any[]);
}

export async function fetchQuarries(params?: { search?: string }): Promise<any[]> {
  return tryFetch('/quarry', params as Record<string, string>, [
    { id: 'q1', name: 'Kisumu Quarry', location: { address: 'Kisumu Industrial Area, Kisumu', latitude: -0.0917, longitude: 34.7680 }, status: 'active', contact: '+254700111001' },
    { id: 'q2', name: 'River Sand Quarry', location: { address: 'Athi River, Machakos', latitude: -1.4567, longitude: 36.9782 }, status: 'active', contact: '+254700111002' },
    { id: 'q3', name: 'Cement Depot', location: { address: 'Bamburi, Mombasa Road', latitude: -1.3456, longitude: 36.7845 }, status: 'active', contact: '+254700111003' },
    { id: 'q4', name: 'Nairobi Quarry', location: { address: 'Kasarani, Nairobi', latitude: -1.2156, longitude: 36.8956 }, status: 'active', contact: '+254700111004' },
    { id: 'q5', name: 'Nakuru Stone Quarry', location: { address: 'Njoro, Nakuru', latitude: -0.3456, longitude: 36.0123 }, status: 'active', contact: '+254700111005' },
  ]);
}

export async function fetchSites(params?: { search?: string }): Promise<any[]> {
  return tryFetch('/site', params as Record<string, string>, [
    { id: 's1', name: 'City Centre Site B', location: { address: 'CBD, Nairobi', latitude: -1.2833, longitude: 36.8167 }, status: 'active', contact: '+254711001001' },
    { id: 's2', name: 'Westlands Tower', location: { address: 'Westlands, Nairobi', latitude: -1.2617, longitude: 36.8073 }, status: 'active', contact: '+254711001002' },
    { id: 's3', name: 'Eastlands Estate', location: { address: 'Eastlands, Nairobi', latitude: -1.3016, longitude: 36.8616 }, status: 'active', contact: '+254711001003' },
    { id: 's4', name: 'Tatu City Phase 2', location: { address: 'Ruiru, Kiambu', latitude: -1.1556, longitude: 36.8956 }, status: 'active', contact: '+254711001004' },
    { id: 's5', name: 'Kilimani Residences', location: { address: 'Kilimani, Nairobi', latitude: -1.2751, longitude: 36.8053 }, status: 'active', contact: '+254711001005' },
  ]);
}

export async function fetchCheckpoints(params?: { jobId?: string; deliveryOrderId?: string }): Promise<Checkpoint[]> {
  return tryFetch('/checkpoints', params as Record<string, string>, MOCK_CHECKPOINTS);
}

export async function fetchJourney(jobId: string): Promise<{ jobId: string; deliveryOrder: any; checkpoints: Checkpoint[] }> {
  try {
    const result = await fetchFromApi<{ jobId: string; deliveryOrder: any; checkpoints: Checkpoint[] }>(`/checkpoints/journey/${jobId}`, undefined);
    return result;
  } catch (e) {
    console.warn(`API fetch failed for checkpoint journey ${jobId}, using mock fallback:`, e);
    const mockCps = MOCK_CHECKPOINTS.filter(c => c.jobId === jobId);
    const deliveryOrder = MOCK_DELIVERY_ORDERS.find((d: any) => d.jobId === jobId) || null;
    return { jobId, deliveryOrder, checkpoints: mockCps };
  }
}

export async function fetchActiveDeliveries(): Promise<any[]> {
  try {
    const result = await fetchFromApi<any[]>('/checkpoints/active', undefined);
    return result;
  } catch (e) {
    console.warn('API fetch failed for active deliveries, using mock fallback:', e);
    // Return active deliveries with their checkpoints
    const activeDOs = MOCK_DELIVERY_ORDERS.filter((d: any) => d.status !== 'delivered');
    return activeDOs.map((d: any) => {
      const doCheckpoints = MOCK_CHECKPOINTS.filter(c => c.deliveryOrderId === d.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return {
        ...d,
        checkpoints: doCheckpoints,
        latestCheckpoint: doCheckpoints[doCheckpoints.length - 1] || null,
        checkpointCount: doCheckpoints.length,
      };
    });
  }
}

// ============== Legacy API Client ==============

// Keep backward compatible API client
interface ApiClient {
  get<T = any>(url: string, params?: any): Promise<{ data: T }>;
  post<T = any>(url: string, data?: any): Promise<{ data: T }>;
  put<T = any>(url: string, data?: any): Promise<{ data: T }>;
  delete<T = any>(url: string): Promise<{ data: T }>;
}

// Real API client using fetch
const realApi: ApiClient = {
  async get<T>(url: string, _params?: any): Promise<{ data: T }> {
    const token = useAuthStore.getState().user?.uid || (await getStoredToken()) || undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 401) useAuthStore.getState().logout();
    if (!res.ok) throw { status: res.status, message: `HTTP ${res.status}` };
    return { data: await res.json() as T };
  },
  async post<T>(url: string, body?: any): Promise<{ data: T }> {
    const token = useAuthStore.getState().user?.uid || (await getStoredToken()) || undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401) useAuthStore.getState().logout();
    if (!res.ok) throw { status: res.status, message: `HTTP ${res.status}` };
    return { data: await res.json() as T };
  },
  async put<T>(url: string, body?: any): Promise<{ data: T }> {
    const token = useAuthStore.getState().user?.uid || (await getStoredToken()) || undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { method: 'PUT', headers, body: body ? JSON.stringify(body) : undefined });
    return { data: await res.json() as T };
  },
  async delete<T>(url: string): Promise<{ data: T }> {
    const token = useAuthStore.getState().user?.uid || (await getStoredToken()) || undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { method: 'DELETE', headers });
    return { data: await res.json() as T };
  },
};

// Mock API client — returns mock data for dev
const mockDataCache: Record<string, any> = {};

const mockApi: ApiClient = {
  async get<T>(url: string, params?: any): Promise<{ data: T }> {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));

    // Dynamically load mock data
    if (!mockDataCache.data) {
      try {
        const mockModule = await import('../store/mockData');
        Object.assign(mockDataCache, mockModule);
      } catch {}
    }

    const search = params?.search?.toLowerCase();
    const status = params?.status;

    if (url.includes('/vendors')) {
      return { data: MOCK_VENDORS_FULL as any as T };
    }

    if (url.includes('/drivers')) {
      let items = mockDataCache.MOCK_DRIVERS || [];
      if (search) {
        items = items.filter((d: any) =>
          (d.name || '').toLowerCase().includes(search) ||
          (d.phone || '').includes(search) ||
          (d.licenseNumber || '').toLowerCase().includes(search)
        );
      }
      return { data: items as any as T };
    }

    if (url.includes('/vehicles') || url.includes('/trucks')) {
      let items = mockDataCache.MOCK_TRUCKS || [];
      if (search) {
        items = items.filter((v: any) =>
          (v.plateNumber || '').toLowerCase().includes(search) ||
          (v.model || '').toLowerCase().includes(search) ||
          (v.make || '').toLowerCase().includes(search)
        );
      }
      return { data: items as any as T };
    }

    if (url.includes('/purchase-orders') || url.includes('/orders')) {
      let items = mockDataCache.MOCK_ORDERS || [];
      if (search) {
        items = items.filter((o: any) =>
          (o.poNumber || '').toLowerCase().includes(search) ||
          (o.vendorName || '').toLowerCase().includes(search) ||
          (o.materialId || '').toLowerCase().includes(search)
        );
      }
      if (status) items = items.filter((o: any) => o.status === status);
      return { data: items as any as T };
    }

    if (url.includes('/delivery-orders') || url.includes('/deliveries')) {
      let items = mockDataCache.MOCK_DELIVERIES || [];
      if (status) items = items.filter((d: any) => d.status === status);
      const jobId = params?.jobId;
      if (jobId) items = items.filter((d: any) => d.jobId === jobId);
      const purchaseOrderId = params?.purchaseOrderId;
      if (purchaseOrderId) items = items.filter((d: any) => d.purchaseOrderId === purchaseOrderId);
      return { data: items as any as T };
    }

    if (url.includes('/weighbridge') || url.includes('/weigh')) {
      return { data: (mockDataCache.MOCK_WEIGHMENTS || []) as any as T };
    }

    if (url.includes('/materials')) {
      return { data: (mockDataCache.MOCK_MATERIALS || []) as any as T };
    }

    if (url.includes('/auth/profile')) {
      return { data: { user: { uid: 'mock_user', email: 'admin@truck.com', displayName: 'James Admin', role: 'management' } } as any as T };
    }

    if (url.includes('/quarries') || url.includes('/quarry')) {
      return { data: [
        { id: 'q1', name: 'Kisumu Quarry', location: { address: 'Kisumu, Kenya', latitude: -0.0917, longitude: 34.7680 }, status: 'active' },
        { id: 'q2', name: 'River Sand Quarry', location: { address: 'Athi River, Machakos', latitude: -1.4567, longitude: 36.9782 }, status: 'active' },
      ] as any as T };
    }

    if (url.includes('/sites') || url.includes('/site')) {
      return { data: [
        { id: 's1', name: 'City Centre Site B', location: { address: 'CBD, Nairobi', latitude: -1.2833, longitude: 36.8167 }, status: 'active' },
        { id: 's2', name: 'Westlands Tower', location: { address: 'Westlands, Nairobi', latitude: -1.2617, longitude: 36.8073 }, status: 'active' },
      ] as any as T };
    }

    if (url.includes('/checkpoints')) {
      let items = [...MOCK_CHECKPOINTS];
      const jobId = params?.jobId;
      if (jobId) items = items.filter(c => c.jobId === jobId);
      const deliveryOrderId = params?.deliveryOrderId;
      if (deliveryOrderId) items = items.filter(c => c.deliveryOrderId === deliveryOrderId);
      return { data: items as any as T };
    }

    if (url.includes('/auth/login')) {
      return { data: { token: 'mock_token', user: { uid: 'mock_user', email: 'admin@truck.com', displayName: 'James Admin', role: 'management' } } as any as T };
    }

    return { data: { items: [] } as any as T };
  },

  async post<T>(url: string, data?: any): Promise<{ data: T }> {
    await new Promise((r) => setTimeout(r, 100));
    if (url.includes('/auth/login')) {
      return { data: { token: 'mock_token', user: { uid: 'mock_user', email: data?.email || 'admin@truck.com', displayName: 'James Admin', role: 'management' } } as any as T };
    }
    if (url.includes('/auth/logout')) {
      return { data: null as any as T };
    }
    return { data: data as any as T };
  },

  async put<T>(url: string, data?: any): Promise<{ data: T }> {
    await new Promise((r) => setTimeout(r, 100));
    return { data: data as any as T };
  },

  async delete<T>(_url: string): Promise<{ data: T }> {
    await new Promise((r) => setTimeout(r, 100));
    return { data: null as any as T };
  },
};

// Use mock by default (set EXPO_PUBLIC_USE_REAL_API=true to use real backend)
const useMock = process.env.EXPO_PUBLIC_USE_REAL_API !== 'true';
const api: ApiClient = useMock ? mockApi : realApi;

export default api;
export type { ApiClient };
