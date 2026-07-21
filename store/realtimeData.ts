/**
 * Backend API Data Hooks (Refactored)
 *
 * Powered by realTimeSyncStore (Zustand) which provides:
 *   - Instant display from SecureStore cache (0ms)
 *   - ETag-backed polling every 30s (only transfers changed data)
 *   - Deduplicated requests across components
 *   - Automatic cleanup on unmount
 *
 * Usage: Same API as before — drop-in replacement for existing hooks.
 *   const vendors = useVendors();
 *   const deliveryOrders = useDeliveryOrders({ status: 'in_transit' });
 */
import { useEffect, useMemo } from 'react';
import { getRealtimeCollectionKey, useRealTimeSyncStore } from './realTimeSyncStore';

// ============================================================
// React hook for any collection — stale-while-revalidate
// ============================================================
export function useRealtimeCollection(
  collectionName: string,
  params?: Record<string, string>
): { data: any[]; loading: boolean; error: string | null } {
  const subscribe = useRealTimeSyncStore((s) => s.subscribe);
  const unsubscribe = useRealTimeSyncStore((s) => s.unsubscribe);

  // Build a stable params key to avoid re-subscribing on every render
  const paramsKey = params
    ? JSON.stringify(Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))))
    : '{}';

  useEffect(() => {
    subscribe(collectionName, params);
    return () => {
      unsubscribe(collectionName, params);
    };
  }, [collectionName, paramsKey, subscribe, unsubscribe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Select stable primitive values from the store instead of the whole
  // collections object.  Zustand's useSyncExternalStore warns when the
  // selector returns a new object reference on every call, which can degrade
  // into an infinite render loop.  By selecting a snapshot of the relevant
  // cache entries as a JSON string we keep the reference stable across
  // updates that only touch unrelated collections.
  // This must match the store's account-scoped cache key exactly. The old
  // suffix-only lookup could never find `sync_cache_<user>_<collection>`,
  // leaving management dashboards blank even after the API had populated it.
  const cacheKey = useMemo(
    () => getRealtimeCollectionKey(collectionName, params),
    [collectionName, paramsKey],
  );

  const snapshot = useRealTimeSyncStore((s) => {
    // Select only this exact collection/query so updates to another collection
    // cannot overwrite its snapshot or cause an unrelated render.
    const entry = s.collections[cacheKey];
    if (!entry) return '';
    return JSON.stringify([entry.data, entry.loading, entry.error]);
  });

  return useMemo(() => {
    if (!snapshot) return { data: [] as any[], loading: false, error: null as string | null };
    try {
      const [data, loading, error] = JSON.parse(snapshot);
      return {
        data: Array.isArray(data) ? data : ([] as any[]),
        loading: Boolean(loading),
        error: (error as string | null) || null,
      };
    } catch {
      return { data: [] as any[], loading: false, error: null as string | null };
    }
  }, [snapshot]);
}

// ============================================================
// Convenience hooks for each collection
// ============================================================
export function useVendors(params?: { search?: string; status?: string }) {
  const { data } = useRealtimeCollection('vendors', params as Record<string, string>);
  return data;
}

export function useDrivers(params?: { status?: string; search?: string }) {
  const { data } = useRealtimeCollection('drivers', params as Record<string, string>);
  return data;
}

export function useVehicles(params?: { status?: string; search?: string }) {
  const { data } = useRealtimeCollection('vehicles', params as Record<string, string>);
  return data;
}

export function useMaterials(params?: { search?: string; category?: string }) {
  const { data } = useRealtimeCollection('materials', params as Record<string, string>);
  return data;
}

export function usePurchaseOrders(params?: { search?: string; status?: string }) {
  const { data } = useRealtimeCollection('purchaseOrders', params as Record<string, string>);
  return data;
}

export function useDeliveryOrders(params?: { search?: string; status?: string; jobId?: string; purchaseOrderId?: string }) {
  const { data } = useRealtimeCollection('deliveryOrders', params as Record<string, string>);
  return data;
}

export function useWeighRecords(params?: { jobId?: string; type?: string }) {
  const { data } = useRealtimeCollection('weighRecords', params as Record<string, string>);
  return data;
}

export function useCheckpoints(params?: { jobId?: string; deliveryOrderId?: string }) {
  const { data } = useRealtimeCollection('checkpoints', params as Record<string, string>);
  return data;
}

export function useQuarries() {
  const { data } = useRealtimeCollection('quarries');
  return data;
}

export function useSites() {
  const { data } = useRealtimeCollection('sites');
  return data;
}

export function useFuelRecords(params?: { search?: string; vendorId?: string; jobId?: string; plateNumber?: string }) {
  const { data } = useRealtimeCollection('fuelRecords', params as Record<string, string>);
  return data;
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
