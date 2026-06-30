/**
 * Real-time Firestore Data Store
 * Uses onSnapshot listeners to maintain live data from Firestore.
 * All data is pure Firebase — no mock data, no HTTP backend calls.
 */
import { useEffect, useRef, useState } from 'react';
import { listenToCollection, listenToQuery } from '../services/firestoreRealtime';
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

// ============================================================
// Singleton listener manager
// ============================================================
let globalListeners: Map<string, { count: number; unsub: Unsubscribe | null; data: any[] }> = new Map();

function ensureListener(collectionName: string): () => void {
  if (!globalListeners.has(collectionName)) {
    globalListeners.set(collectionName, { count: 0, unsub: null, data: [] });
  }
  const entry = globalListeners.get(collectionName)!;
  entry.count++;

  if (entry.count === 1 || !entry.unsub) {
    console.log(`[Realtime] Starting onSnapshot for: ${collectionName}`);
    entry.unsub = listenToCollection(
      collectionName,
      (docs) => {
        console.log(`[Realtime] ${collectionName} updated:`, docs.length, 'items', docs);
        entry.data = docs;
        // Notify all subscribers via a simple event
        window.dispatchEvent(new CustomEvent(`firestore:${collectionName}`, { detail: docs }));
      },
      (error) => {
        console.warn(`[Realtime] ${collectionName} listener error:`, error.message);
      }
    );
  }

  // Return cleanup function
  return () => {
    const e = globalListeners.get(collectionName);
    if (!e) return;
    e.count--;
    if (e.count <= 0 && e.unsub) {
      console.log(`[Realtime] Stopping onSnapshot for: ${collectionName}`);
      e.unsub();
      e.unsub = null;
      globalListeners.delete(collectionName);
    }
  };
}

// ============================================================
// React hook for any collection
// ============================================================
export function useRealtimeCollection(collectionName: string, filter?: { field: string; op: any; value: any }): any[] {
  const [data, setData] = useState<any[]>([]);
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    console.log(`[Realtime] Subscribing to: ${collectionName}`);
    let unsub: Unsubscribe;

    if (filter) {
      unsub = listenToQuery(
        collectionName,
        filter.field,
        filter.op,
        filter.value,
        (docs) => {
          console.log(`[Realtime] ${collectionName} (filtered) updated:`, docs.length, 'items', docs);
          setData(docs);
        },
        (err) => console.warn(`[Realtime] ${collectionName} filter error:`, err.message)
      );
    } else {
      unsub = listenToCollection(
        collectionName,
        (docs) => {
          console.log(`[Realtime] ${collectionName} updated:`, docs.length, 'items', docs);
          setData(docs);
        },
        (err) => console.warn(`[Realtime] ${collectionName} error:`, err.message)
      );
    }

    unsubRef.current = unsub;
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