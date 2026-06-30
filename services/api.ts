import { useAuthStore } from '../store/authStore';
import { getStoredToken } from './database';
import axios from 'axios';
import {  
  MOCK_DRIVERS, MOCK_TRUCKS, MOCK_MATERIALS,
  MOCK_PURCHASE_ORDERS, MOCK_DELIVERY_ORDERS, MOCK_WEIGHMENTS,
} from '../store/mockData';
import {
  listenToCollection,
  listenToQuery,
} from './firestoreRealtime';

// Mock vendors (inline)
const MOCK_VENDORS_FULL = [
  { id: 'v1', name: 'Mwangi Transport Ltd', phone: '+254712345601', email: 'info@mwangi.co.ke', address: 'Nairobi Industrial Area', status: 'active', fleetSize: 4, createdAt: '2026-01-10T08:00:00Z' },
  { id: 'v2', name: 'Kamau Trucking Co', phone: '+254712345602', email: 'info@kamauco.ke', address: 'Mombasa Road', status: 'active', fleetSize: 3, createdAt: '2026-02-15T09:00:00Z' },
  { id: 'v3', name: 'Ochieng Supplies Ltd', phone: '+254712345603', email: 'info@ochieng.co.ke', address: 'Kisumu Industrial Park', status: 'active', fleetSize: 2, createdAt: '2026-03-20T10:00:00Z' },
  { id: 'v4', name: 'Njoroge Heavy Haulage', phone: '+254712345604', email: 'info@njoroge.co.ke', address: 'Thika Road', status: 'active', fleetSize: 5, createdAt: '2026-04-10T11:00:00Z' },
  { id: 'v5', name: 'Wanjiku Logistics', phone: '+254712345605', email: 'info@wanjikulogistics.co.ke', address: 'Nakuru Highway', status: 'inactive', fleetSize: 1, createdAt: '2026-05-05T12:00:00Z' },
];

// ============== Firestore Live Data ==============
// Firestore listeners disabled by default — connect via backend API.
// Uncomment startFirestoreListeners() to enable direct Firestore access
// (requires proper Firestore security rules).

let firestoreUnsubscribers: (() => void)[] = [];

function startFirestoreListeners() {
  firestoreUnsubscribers.forEach((unsub) => unsub());
  firestoreUnsubscribers = [];

  const errorCb = (err: Error) => {
    console.warn('Firestore listener error (using mock fallback):', err.message);
  };

  try {
    const unsub1 = listenToCollection('vendors', (docs: any[]) => {
      if (docs.length > 0) MOCK_VENDORS_CACHE = docs;
    }, errorCb);
    const unsub2 = listenToCollection('drivers', (docs: any[]) => {
      if (docs.length > 0) MOCK_DRIVERS_CACHE = docs;
    }, errorCb);
    const unsub3 = listenToCollection('vehicles', (docs: any[]) => {
      if (docs.length > 0) MOCK_TRUCKS_CACHE = docs;
    }, errorCb);
    const unsub4 = listenToCollection('materials', (docs: any[]) => {
      if (docs.length > 0) MOCK_MATERIALS_CACHE = docs;
    }, errorCb);
    const unsub5 = listenToCollection('purchaseOrders', (docs: any[]) => {
      if (docs.length > 0) MOCK_ORDERS_CACHE = docs;
    }, errorCb);
    const unsub6 = listenToCollection('deliveryOrders', (docs: any[]) => {
      if (docs.length > 0) MOCK_DELIVERIES_CACHE = docs;
    }, errorCb);
    firestoreUnsubscribers = [unsub1, unsub2, unsub3, unsub4, unsub5, unsub6];
  } catch (e) {
    // Silently fallback to mock data
  }
}

// Disabled by default — backend API handles data.
// startFirestoreListeners();

// Cached data from Firestore (falls back to mock)
let MOCK_VENDORS_CACHE: any[] = MOCK_VENDORS_FULL;
let MOCK_DRIVERS_CACHE: any[] = MOCK_DRIVERS as any[];
let MOCK_TRUCKS_CACHE: any[] = MOCK_TRUCKS as any[];
let MOCK_MATERIALS_CACHE: any[] = MOCK_MATERIALS as any[];
let MOCK_ORDERS_CACHE: any[] = MOCK_PURCHASE_ORDERS as any[];
let MOCK_DELIVERIES_CACHE: any[] = MOCK_DELIVERY_ORDERS as any[];

// ============== Fetch Functions ==============

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

async function backendRequest<T>(method: 'get' | 'post' | 'put' | 'delete', url: string, data?: any, params?: any): Promise<T> {
  if (!API_BASE_URL) throw new Error('Backend API URL is not configured');
  const token = await getStoredToken();
  const response = await axios.request<T>({
    baseURL: API_BASE_URL,
    url,
    method,
    data,
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data;
}

function unwrapItems<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function unwrapOne<T = any>(data: any, fallback: T): T {
  return (data?.item || data?.data || data?.deliveryOrder || data?.delivery || data) as T || fallback;
}

function getCache(key: string): any[] {
  switch (key) {
    case 'vendors': return MOCK_VENDORS_CACHE;
    case 'drivers': return MOCK_DRIVERS_CACHE;
    case 'vehicles': return MOCK_TRUCKS_CACHE;
    case 'materials': return MOCK_MATERIALS_CACHE;
    case 'orders': return MOCK_ORDERS_CACHE;
    case 'deliveries': return MOCK_DELIVERIES_CACHE;
    default: return [];
  }
}

function delay(ms = 100) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchVendors(params?: { search?: string; status?: string }): Promise<any[]> {
  try {
    if (API_BASE_URL) return unwrapItems(await backendRequest('get', '/vendors', undefined, params));
  } catch (error) {
    console.warn('Backend vendors fetch failed, using mock fallback:', error);
  }
  await delay();
  let items = getCache('vendors');
  const search = params?.search?.toLowerCase();
  const status = params?.status;
  if (search) items = items.filter((v: any) => (v.name || '').toLowerCase().includes(search));
  if (status) items = items.filter((v: any) => v.status === status);
  return items;
}

export async function fetchDrivers(params?: { search?: string; status?: string }): Promise<any[]> {
  try {
    if (API_BASE_URL) return unwrapItems(await backendRequest('get', '/drivers', undefined, params));
  } catch (error) {
    console.warn('Backend drivers fetch failed, using mock fallback:', error);
  }
  await delay();
  let items = getCache('drivers');
  const search = params?.search?.toLowerCase();
  const status = params?.status;
  if (search) items = items.filter((d: any) => (d.name || d.fullName || '').toLowerCase().includes(search) || (d.phone || '').includes(search));
  if (status) items = items.filter((d: any) => d.status === status);
  return items;
}

export async function fetchVehicles(params?: { search?: string; status?: string }): Promise<any[]> {
  try {
    if (API_BASE_URL) return unwrapItems(await backendRequest('get', '/vehicles', undefined, params));
  } catch (error) {
    console.warn('Backend vehicles fetch failed, using mock fallback:', error);
  }
  await delay();
  let items = getCache('vehicles');
  const search = params?.search?.toLowerCase();
  const status = params?.status;
  if (search) items = items.filter((v: any) => (v.plateNumber || '').toLowerCase().includes(search) || (v.model || '').toLowerCase().includes(search));
  if (status) items = items.filter((v: any) => v.status === status);
  return items;
}

export async function fetchMaterials(params?: { search?: string; category?: string }): Promise<any[]> {
  await delay();
  let items = getCache('materials');
  const search = params?.search?.toLowerCase();
  if (search) items = items.filter((m: any) => (m.name || '').toLowerCase().includes(search) || (m.category || '').toLowerCase().includes(search));
  return items;
}

export async function fetchPurchaseOrders(params?: { search?: string; status?: string }): Promise<any[]> {
  try {
    if (API_BASE_URL) return unwrapItems(await backendRequest('get', '/purchase-orders', undefined, params));
  } catch (error) {
    console.warn('Backend purchase orders fetch failed, using mock fallback:', error);
  }
  await delay();
  let items = getCache('orders');
  const search = params?.search?.toLowerCase();
  if (search) items = items.filter((o: any) => (o.poNumber || '').toLowerCase().includes(search) || (o.vendorName || '').toLowerCase().includes(search));
  return items;
}

export async function fetchDeliveryOrders(params?: { search?: string; status?: string; jobId?: string; purchaseOrderId?: string }): Promise<any[]> {
  try {
    if (API_BASE_URL) return unwrapItems(await backendRequest('get', '/delivery-orders', undefined, params));
  } catch (error) {
    console.warn('Backend delivery orders fetch failed, using mock fallback:', error);
  }
  await delay();
  let items = getCache('deliveries');
  const { jobId, purchaseOrderId } = params || {};
  if (jobId) items = items.filter((d: any) => d.jobId === jobId || d.id === jobId);
  if (purchaseOrderId) items = items.filter((d: any) => d.purchaseOrderId === purchaseOrderId);
  return items;
}

export async function createDeliveryOrder(payload: any): Promise<any> {
  try {
    if (API_BASE_URL) {
      return unwrapOne(await backendRequest('post', '/delivery-orders', payload), payload);
    }
  } catch (error) {
    console.warn('Backend delivery order create failed, using mock fallback:', error);
  }
  await delay();
  MOCK_DELIVERIES_CACHE = [payload, ...MOCK_DELIVERIES_CACHE];
  return payload;
}

export async function updateDeliveryOrder(id: string, payload: any): Promise<any> {
  try {
    if (API_BASE_URL) {
      return unwrapOne(await backendRequest('put', `/delivery-orders/${id}`, payload), payload);
    }
  } catch (error) {
    console.warn('Backend delivery order update failed, using mock fallback:', error);
  }
  await delay();
  MOCK_DELIVERIES_CACHE = MOCK_DELIVERIES_CACHE.map((item: any) =>
    item.id === id ? { ...item, ...payload } : item
  );
  return { ...MOCK_DELIVERIES_CACHE.find((item: any) => item.id === id), ...payload };
}

export async function fetchWeighments(params?: { jobId?: string; type?: string }): Promise<any[]> {
  await delay();
  return MOCK_WEIGHMENTS as any[];
}

export async function fetchQuarries(): Promise<any[]> {
  await delay();
  return [
    { id: 'q1', name: 'Kisumu Quarry', location: { address: 'Kisumu Industrial Area, Kisumu', latitude: -0.0917, longitude: 34.7680 }, status: 'active', contact: '+254700111001' },
    { id: 'q2', name: 'River Sand Quarry', location: { address: 'Athi River, Machakos', latitude: -1.4567, longitude: 36.9782 }, status: 'active', contact: '+254700111002' },
    { id: 'q3', name: 'Cement Depot', location: { address: 'Bamburi, Mombasa Road', latitude: -1.3456, longitude: 36.7845 }, status: 'active', contact: '+254700111003' },
    { id: 'q4', name: 'Nairobi Quarry', location: { address: 'Kasarani, Nairobi', latitude: -1.2156, longitude: 36.8956 }, status: 'active', contact: '+254700111004' },
  ];
}

export async function fetchSites(): Promise<any[]> {
  await delay();
  return [
    { id: 's1', name: 'City Centre Site B', location: { address: 'CBD, Nairobi', latitude: -1.2833, longitude: 36.8167 }, status: 'active' },
    { id: 's2', name: 'Westlands Tower', location: { address: 'Westlands, Nairobi', latitude: -1.2617, longitude: 36.8073 }, status: 'active' },
    { id: 's3', name: 'Eastlands Estate', location: { address: 'Eastlands, Nairobi', latitude: -1.3016, longitude: 36.8616 }, status: 'active' },
    { id: 's4', name: 'Tatu City Phase 2', location: { address: 'Ruiru, Kiambu', latitude: -1.1556, longitude: 36.8956 }, status: 'active' },
  ];
}

export async function fetchCheckpoints(params?: { jobId?: string; deliveryOrderId?: string }): Promise<any[]> {
  await delay();
  // Return simplified checkpoints - in_transit removed
  const checkpoints = [
    { id: 'cp1', deliveryOrderId: 'do1', jobId: 'JOB-2026-0001', type: 'weigh_in', timestamp: '2026-06-25T07:30:00Z', location: 'Quarry Gate' },
    { id: 'cp2', deliveryOrderId: 'do1', jobId: 'JOB-2026-0001', type: 'loading', timestamp: '2026-06-25T08:30:00Z', location: 'Quarry Loading Bay' },
    { id: 'cp3', deliveryOrderId: 'do1', jobId: 'JOB-2026-0001', type: 'weigh_out', timestamp: '2026-06-25T09:00:00Z', location: 'Quarry Exit' },
    { id: 'cp4', deliveryOrderId: 'do1', jobId: 'JOB-2026-0001', type: 'arrived_site', timestamp: '2026-06-25T11:00:00Z', location: 'Site Gate' },
  ];
  const { jobId, deliveryOrderId } = params || {};
  let result = checkpoints;
  if (jobId) result = result.filter((c) => c.jobId === jobId);
  if (deliveryOrderId) result = result.filter((c) => c.deliveryOrderId === deliveryOrderId);
  return result;
}

// Legacy API client
interface ApiClient {
  get<T = any>(url: string, params?: any): Promise<{ data: T }>;
  post<T = any>(url: string, data?: any): Promise<{ data: T }>;
  put<T = any>(url: string, data?: any): Promise<{ data: T }>;
  delete<T = any>(url: string): Promise<{ data: T }>;
}

const api: ApiClient = {
  async get<T>(url: string, params?: any): Promise<{ data: T }> {
    try {
      if (API_BASE_URL) return { data: await backendRequest<T>('get', url, undefined, params) };
    } catch (error) {
      console.warn(`Backend GET ${url} failed, using mock fallback:`, error);
    }
    await delay(50);
    const search = params?.search?.toLowerCase();
    if (url.includes('/vendors')) return { data: getCache('vendors') as any as T };
    if (url.includes('/drivers')) {
      let items = getCache('drivers');
      if (search) items = items.filter((d: any) => (d.name || '').toLowerCase().includes(search));
      return { data: items as any as T };
    }
    if (url.includes('/vehicles') || url.includes('/trucks')) return { data: getCache('vehicles') as any as T };
    if (url.includes('/materials')) return { data: getCache('materials') as any as T };
    if (url.includes('/purchase-orders') || url.includes('/orders')) return { data: getCache('orders') as any as T };
    if (url.includes('/delivery-orders') || url.includes('/deliveries')) return { data: getCache('deliveries') as any as T };
    if (url.includes('/auth/profile')) return { data: { user: { uid: 'mock', email: 'admin@truck.com', displayName: 'James Admin', role: 'management' } } as any as T };
    return { data: { items: [] } as any as T };
  },
  async post<T>(_url: string, data?: any): Promise<{ data: T }> {
    try {
      if (API_BASE_URL) return { data: await backendRequest<T>('post', _url, data) };
    } catch (error) {
      console.warn(`Backend POST ${_url} failed, using mock fallback:`, error);
    }
    await delay(50);
    if (_url.includes('/auth/login')) {
      return { data: { token: 'mock_token', user: { uid: 'mock_user', email: data?.email || 'admin@truck.com', displayName: 'James Admin', role: 'management' } } as any as T };
    }
    if (_url.includes('/delivery-orders') || _url.includes('/deliveries')) {
      MOCK_DELIVERIES_CACHE = [data, ...MOCK_DELIVERIES_CACHE];
      return { data: data as any as T };
    }
    return { data: null as any as T };
  },
  async put<T>(_url: string, data?: any): Promise<{ data: T }> {
    try {
      if (API_BASE_URL) return { data: await backendRequest<T>('put', _url, data) };
    } catch (error) {
      console.warn(`Backend PUT ${_url} failed, using mock fallback:`, error);
    }
    await delay(50);
    return { data: data as any as T };
  },
  async delete<T>(url: string): Promise<{ data: T }> {
    try {
      if (API_BASE_URL) return { data: await backendRequest<T>('delete', url) };
    } catch (error) {
      console.warn(`Backend DELETE ${url} failed, using mock fallback:`, error);
    }
    await delay(50);
    return { data: null as any as T };
  },
};

export default api;
export type { ApiClient };
