/**
 * TruckSphere API Service
 * All data is fetched from the backend API (Firebase-backed).
 * No mock data — every function calls the backend.
 * Gracefully returns empty arrays on network errors.
 */
import axios from 'axios';
import { getStoredToken } from './database';

import { Platform } from 'react-native';

// Detect environment for API URL
function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // Physical device or custom IP from env
  if (process.env.EXPO_PUBLIC_API_IP) return `http://${process.env.EXPO_PUBLIC_API_IP}:5000`;
  // Android emulator can't reach localhost — use 10.0.2.2
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  // iOS simulator and web can use localhost
  return 'http://192.168.1.4:5000';
}

const API_BASE_URL = getBaseUrl();

console.log('[API] Base URL:', API_BASE_URL);
console.log('[API] Platform:', Platform.OS, '| ENV vars:', {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || '(not set)',
  EXPO_PUBLIC_API_IP: process.env.EXPO_PUBLIC_API_IP || '(not set)',
});

// ============== HTTP Helpers ==============

async function backendRequest<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: any,
  params?: any
): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await axios.request<T>({
    baseURL: API_BASE_URL,
    url,
    method,
    data,
    params,
    headers,
    timeout: 10000,
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
  return (data?.item || data?.data || data) as T || fallback;
}

/**
 * Wraps an async fetch so it never throws.
 * On error, logs to console and returns an empty array.
 */
async function safeFetch<T>(
  label: string,
  fetcher: () => Promise<T[]>
): Promise<T[]> {
  try {
    console.log(`[API] Fetching ${label} from backend...`);
    const result = await fetcher();
    console.log(`[API] ${label} fetched:`, result.length, 'items', result);
    return result;
  } catch (error: any) {
    const msg = error?.message || error?.code || String(error);
    console.warn(`[API] ❌ ${label} fetch failed → ${API_BASE_URL}`, msg);
    return [];
  }
}

// ============== Fetch Functions (all via backend, graceful fallback) ==============

export async function fetchVendors(params?: { search?: string; status?: string }): Promise<any[]> {
  return safeFetch('vendors', () =>
    backendRequest<any>('get', '/api/vendors', undefined, params).then(unwrapItems)
  );
}

export async function fetchDrivers(params?: { search?: string; status?: string }): Promise<any[]> {
  return safeFetch('drivers', () =>
    backendRequest<any>('get', '/api/drivers', undefined, params).then(unwrapItems)
  );
}

export async function fetchVehicles(params?: { search?: string; status?: string }): Promise<any[]> {
  return safeFetch('vehicles', () =>
    backendRequest<any>('get', '/api/vehicles', undefined, params).then(unwrapItems)
  );
}

export async function fetchMaterials(params?: { search?: string; category?: string }): Promise<any[]> {
  return safeFetch('materials', () =>
    backendRequest<any>('get', '/api/materials', undefined, params).then(unwrapItems)
  );
}

export async function fetchPurchaseOrders(params?: { search?: string; status?: string }): Promise<any[]> {
  return safeFetch('purchase-orders', () =>
    backendRequest<any>('get', '/api/purchase-orders', undefined, params).then(unwrapItems)
  );
}

export async function fetchDeliveryOrders(params?: { search?: string; status?: string; jobId?: string; purchaseOrderId?: string }): Promise<any[]> {
  return safeFetch('delivery-orders', () => {
    const url = '/api/delivery-orders';
    return backendRequest<any>('get', url, undefined, params).then(unwrapItems);
  });
}

export async function createDeliveryOrder(payload: any): Promise<any> {
  try {
    console.log('[API] Creating delivery order...', payload);
    const result = unwrapOne(await backendRequest('post', '/api/delivery-orders', payload), payload);
    console.log('[API] Delivery order created:', result);
    return result;
  } catch (error: any) {
    console.warn('[API] createDeliveryOrder failed:', error?.message || error);
    return payload;
  }
}

export async function updateDeliveryOrder(id: string, payload: any): Promise<any> {
  try {
    console.log('[API] Updating delivery order:', id, payload);
    const result = unwrapOne(await backendRequest('put', `/api/delivery-orders/${id}`, payload), payload);
    console.log('[API] Delivery order updated:', result);
    return result;
  } catch (error: any) {
    console.warn('[API] updateDeliveryOrder failed:', error?.message || error);
    return payload;
  }
}

export async function fetchWeighments(params?: { jobId?: string; type?: string }): Promise<any[]> {
  return safeFetch('weighments', () =>
    backendRequest<any>('get', '/api/weighbridge', undefined, params).then(unwrapItems)
  );
}

export async function fetchQuarries(): Promise<any[]> {
  return safeFetch('quarries', () =>
    backendRequest<any>('get', '/api/quarries').then(unwrapItems)
  );
}

export async function fetchSites(): Promise<any[]> {
  return safeFetch('sites', () =>
    backendRequest<any>('get', '/api/sites').then(unwrapItems)
  );
}

export async function fetchCheckpoints(params?: { jobId?: string; deliveryOrderId?: string }): Promise<any[]> {
  return safeFetch('checkpoints', () => {
    const url = '/api/checkpoints';
    return backendRequest<any>('get', url, undefined, params).then(unwrapItems);
  });
}

// ============== Legacy API Client (used by authStore & other code) ==============

interface ApiClient {
  get<T = any>(url: string, params?: any): Promise<{ data: T }>;
  post<T = any>(url: string, data?: any): Promise<{ data: T }>;
  put<T = any>(url: string, data?: any): Promise<{ data: T }>;
  delete<T = any>(url: string): Promise<{ data: T }>;
}

const api: ApiClient = {
  async get<T>(url: string, params?: any): Promise<{ data: T }> {
    console.log('[API] GET', url, params);
    try {
      const result = await backendRequest<T>('get', url, undefined, params);
      return { data: result };
    } catch (error: any) {
      // Auth profile failures are expected during session restore — use warn, not error
      const isAuthProfile = url.includes('/auth/profile');
      const msg = error?.response?.status
        ? `${error.response.status} ${error.response.statusText || ''}`
        : (error?.message || 'Network Error');
      if (isAuthProfile) {
        console.warn(`[API] GET ${url} @ ${API_BASE_URL} failed (${msg}) — handled by authStore`);
      } else {
        console.error(`[API] GET ${url} @ ${API_BASE_URL} failed:`, msg);
      }
      throw error;
    }
  },

  async post<T>(url: string, data?: any): Promise<{ data: T }> {
    console.log('[API] POST', url, data);
    try {
      const result = await backendRequest<T>('post', url, data);
      return { data: result };
    } catch (error: any) {
      // Auth-related failures (logout 404, login INVALID_EMAIL) are expected
      const isAuthEndpoint = url.includes('/auth/');
      const msg = error?.response?.status
        ? `${error.response.status} ${error.response.statusText || ''}`
        : (error?.message || 'Network Error');
      if (isAuthEndpoint) {
        console.warn(`[API] POST ${url} @ ${API_BASE_URL} failed (${msg}) — handled by caller`);
      } else {
        console.error(`[API] POST ${url} @ ${API_BASE_URL} failed:`, msg);
      }
      throw error;
    }
  },

  async put<T>(url: string, data?: any): Promise<{ data: T }> {
    console.log('[API] PUT', url, data);
    try {
      const result = await backendRequest<T>('put', url, data);
      return { data: result };
    } catch (error: any) {
      console.error(`[API] PUT ${url} failed:`, error?.message || error);
      throw error;
    }
  },

  async delete<T>(url: string): Promise<{ data: T }> {
    console.log('[API] DELETE', url);
    try {
      const result = await backendRequest<T>('delete', url);
      return { data: result };
    } catch (error: any) {
      console.error(`[API] DELETE ${url} failed:`, error?.message || error);
      throw error;
    }
  },
};

export default api;
export type { ApiClient };