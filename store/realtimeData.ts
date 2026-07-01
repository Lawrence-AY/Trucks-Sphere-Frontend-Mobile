/**
 * Backend API Data Store
 * All data is fetched from the backend API (Firebase-backed).
 * No direct Firestore access from the frontend.
 * Data is cached locally via SecureStore for offline use.
 */
import { useEffect, useState } from 'react';
import { setItem, getItem } from '../services/database';
import * as api from '../services/api';

const CACHE_PREFIX = 'rt_cache_';

// ============================================================
// React hook for any collection with local caching + backend API
// ============================================================
export function useRealtimeCollection(
  collectionName: string,
  params?: Record<string, string>
): any[] {
  const [data, setData] = useState<any[]>([]);
  const filterKey = params ? `_${Object.entries(params).map(([k, v]) => `${k}_${v}`).join('_')}` : '';
  const cacheKey = CACHE_PREFIX + collectionName + filterKey;

  useEffect(() => {
    let cancelled = false;

    // Load cached data first for instant display
    getItem(cacheKey)
      .then((cached) => {
        if (cached && !cancelled) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`[Data] Loaded cached ${collectionName}:`, parsed.length, 'items');
              setData(parsed);
            }
          } catch {}
        }
      })
      .catch(() => {});

    // Map collection names to API functions
    const fetchers: Record<string, (p?: any) => Promise<any[]>> = {
      vendors: api.fetchVendors,
      drivers: api.fetchDrivers,
      vehicles: api.fetchVehicles,
      materials: api.fetchMaterials,
      purchaseOrders: api.fetchPurchaseOrders,
      deliveryOrders: api.fetchDeliveryOrders,
      weighRecords: api.fetchWeighments,
      checkpoints: api.fetchCheckpoints,
      quarries: api.fetchQuarries,
      sites: api.fetchSites,
    };

    const fetchFn = fetchers[collectionName];
    if (!fetchFn) {
      console.warn(`[Data] Unknown collection: ${collectionName}`);
      return;
    }

    console.log(`[Data] Fetching ${collectionName} from backend...`);
    fetchFn(params)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setItem(cacheKey, JSON.stringify(result)).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn(`[Data] ${collectionName} fetch error:`, err?.message || err);
      });

    return () => {
      cancelled = true;
    };
  }, [collectionName, filterKey]);

  return data;
}

// ============================================================
// Convenience hooks for each collection
// ============================================================
export function useVendors(params?: { search?: string; status?: string }) {
  return useRealtimeCollection('vendors', params as Record<string, string>);
}

export function useDrivers(params?: { status?: string; search?: string }) {
  return useRealtimeCollection('drivers', params as Record<string, string>);
}

export function useVehicles(params?: { status?: string; search?: string }) {
  return useRealtimeCollection('vehicles', params as Record<string, string>);
}

export function useMaterials(params?: { search?: string; category?: string }) {
  return useRealtimeCollection('materials', params as Record<string, string>);
}

export function usePurchaseOrders(params?: { search?: string; status?: string }) {
  return useRealtimeCollection('purchaseOrders', params as Record<string, string>);
}

export function useDeliveryOrders(params?: { search?: string; status?: string; jobId?: string; purchaseOrderId?: string }) {
  return useRealtimeCollection('deliveryOrders', params as Record<string, string>);
}

export function useWeighRecords(params?: { jobId?: string; type?: string }) {
  return useRealtimeCollection('weighRecords', params as Record<string, string>);
}

export function useCheckpoints(params?: { jobId?: string; deliveryOrderId?: string }) {
  return useRealtimeCollection('checkpoints', params as Record<string, string>);
}

export function useQuarries() {
  return useRealtimeCollection('quarries');
}

export function useSites() {
  return useRealtimeCollection('sites');
}

// ============================================================
// All-in-one hook for dashboards
// ============================================================
export function useAllData() {
  const vendors = useVendors();
  const drivers = useDrivers();
  const vehicles = useVehicles();
  const materials = useMaterials();
  const purchaseOrders = usePurchaseOrders();
  const deliveryOrders = useDeliveryOrders();
  const weighRecords = useWeighRecords();
  const checkpoints = useCheckpoints();
  const quarries = useQuarries();
  const sites = useSites();

  return {
    vendors,
    drivers,
    vehicles,
    materials,
    purchaseOrders,
    deliveryOrders,
    weighRecords,
    checkpoints,
    quarries,
    sites,
    loading:
      vendors.length === 0 &&
      drivers.length === 0 &&
      vehicles.length === 0,
  };
}
