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
import { useEffect, useMemo, useRef } from 'react';
import { useRealTimeSyncStore } from './realTimeSyncStore';

// ============================================================
// React hook for any collection — stale-while-revalidate
// ============================================================
export function useRealtimeCollection(
  collectionName: string,
  params?: Record<string, string>
): { data: any[]; loading: boolean; error: string | null } {
  const subscribe = useRealTimeSyncStore((s) => s.subscribe);
  const unsubscribe = useRealTimeSyncStore((s) => s.unsubscribe);
  const getData = useRealTimeSyncStore((s) => s.getData);
  const isLoading = useRealTimeSyncStore((s) => s.isLoading);
  const getError = useRealTimeSyncStore((s) => s.getError);

  // Build a stable params key to avoid re-subscribing on every render
  const paramsKey = JSON.stringify(params);

  // Track previous subscription to clean up on params change
  const prevKeyRef = useRef<string>(paramsKey);

  useEffect(() => {
    // Unsubscribe from previous params if they changed
    if (prevKeyRef.current !== paramsKey) {
      const prevParams = prevKeyRef.current !== '{}'
        ? JSON.parse(prevKeyRef.current)
        : undefined;
      unsubscribe(collectionName, prevParams);
    }
    prevKeyRef.current = paramsKey;

    subscribe(collectionName, params);
    return () => {
      unsubscribe(collectionName, params);
    };
  }, [collectionName, paramsKey, subscribe, unsubscribe]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = getData(collectionName);
  const loading = isLoading(collectionName);
  const error = getError(collectionName);

  return { data, loading, error };
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