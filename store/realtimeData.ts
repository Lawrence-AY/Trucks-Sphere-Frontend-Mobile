/**
 * Real-time Firestore Data Store
 * Uses onSnapshot listeners to maintain live data from Firestore.
 * Data is cached locally via AsyncStorage/SecureStore for offline use.
 */
import { useEffect, useState } from 'react';
import { listenToCollection, listenToQuery } from '../services/firestoreRealtime';
import { setItem, getItem } from '../services/database';
import { Unsubscribe } from 'firebase/firestore';

// ============================================================
// Type-safe collection names
// ============================================================
const COLLECTIONS = {
  vendors: 'vendors',
  drivers: 'drivers',
  vehicles: 'vehicles',
  materials: 'materials',
  purchaseOrders: 'purchaseOrders',
  deliveryOrders: 'deliveryOrders',
  weighRecords: 'weighRecords',
  checkpoints: 'checkpoints',
  quarries: 'quarries',
  sites: 'sites',
} as const;

const CACHE_PREFIX = 'rt_cache_';

// ============================================================
// React hook for any collection with local caching
// ============================================================
export function useRealtimeCollection(
  collectionName: string,
  filter?: { field: string; op: any; value: any }
): any[] {
  const [data, setData] = useState<any[]>([]);
  const cacheKey = CACHE_PREFIX + collectionName + (filter ? `_${filter.field}_${filter.value}` : '');

  useEffect(() => {
    // Load cached data first for instant display
    getItem(cacheKey)
      .then((cached) => {
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`[Realtime] Loaded cached ${collectionName}:`, parsed.length, 'items');
              setData(parsed);
            }
          } catch {}
        }
      })
      .catch(() => {});

    console.log(`[Realtime] Subscribing to: ${collectionName}`);
    let unsub: Unsubscribe;

    const onData = (docs: any[]) => {
      setData(docs);
      // Cache data locally
      setItem(cacheKey, JSON.stringify(docs)).catch(() => {});
    };

    if (filter) {
      unsub = listenToQuery(
        collectionName,
        filter.field,
        filter.op,
        filter.value,
        onData,
        (err) => console.warn(`[Realtime] ${collectionName} filter error:`, err.message)
      );
    } else {
      unsub = listenToCollection(
        collectionName,
        onData,
        (err) => console.warn(`[Realtime] ${collectionName} error:`, err.message)
      );
    }

    return () => {
      console.log(`[Realtime] Unsubscribing from: ${collectionName}`);
      unsub();
    };
  }, [collectionName, filter?.field, filter?.op, filter?.value]);

  return data;
}

// ============================================================
// Convenience hooks for each collection
// ============================================================
export function useVendors() {
  return useRealtimeCollection(COLLECTIONS.vendors);
}

export function useDrivers(params?: { status?: string }) {
  const filter = params?.status
    ? { field: 'status', op: '==' as const, value: params.status }
    : undefined;
  return useRealtimeCollection(COLLECTIONS.drivers, filter);
}

export function useVehicles(params?: { status?: string }) {
  const filter = params?.status
    ? { field: 'status', op: '==' as const, value: params.status }
    : undefined;
  return useRealtimeCollection(COLLECTIONS.vehicles, filter);
}

export function useMaterials() {
  return useRealtimeCollection(COLLECTIONS.materials);
}

export function usePurchaseOrders() {
  return useRealtimeCollection(COLLECTIONS.purchaseOrders);
}

export function useDeliveryOrders() {
  return useRealtimeCollection(COLLECTIONS.deliveryOrders);
}

export function useWeighRecords() {
  return useRealtimeCollection(COLLECTIONS.weighRecords);
}

export function useCheckpoints() {
  return useRealtimeCollection(COLLECTIONS.checkpoints);
}

export function useQuarries() {
  return useRealtimeCollection(COLLECTIONS.quarries);
}

export function useSites() {
  return useRealtimeCollection(COLLECTIONS.sites);
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