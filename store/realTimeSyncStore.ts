/**
 * Real-Time Sync Store (Zustand)
 *
 * Centralized store that deduplicates API requests across components,
 * implements stale-while-revalidate caching, and supports ETag-based
 * polling for seamless data updates without manual refresh.
 *
 * Architecture:
 *   1. Each collection has a shared cache (data + ETag + timestamp)
 *   2. Components call subscribe() to register interest
 *   3. On mount: serve cached data from SecureStore instantly (0ms)
 *   4. Background: fetch from backend; if 304, keep cached; if 200, update
 *   5. Poll every ~30s using ETags — only transfer changed data
 *   6. Multiple components using the same collection share one fetch
 */

import { create } from 'zustand';
import { setItem, getItem } from '../services/database';
import * as api from '../services/api';
import { API_BASE_URL } from '../services/config';

// ─── Types ───
interface CollectionEntry {
  data: any[];
  // Retained for compatibility with the existing store API. The backend now
  // disables ETag-based browser revalidation for authenticated collections.
  hash: string;
  timestamp: number;      // Last successful fetch time
  loading: boolean;
  error: string | null;
  subscribers: number;    // How many components are using this
  pollInterval: ReturnType<typeof setInterval> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  liveSyncStop: (() => void) | null;
}

interface SyncState {
  collections: Record<string, CollectionEntry>;
  // Subscribe to a collection — returns current data
  subscribe: (collectionName: string, params?: Record<string, string>) => void;
  // Unsubscribe from a collection
  unsubscribe: (collectionName: string, params?: Record<string, string>) => void;
  // Force refresh a collection
  refresh: (collectionName: string, params?: Record<string, string>) => Promise<void>;
  // Optimistic update: immediately push new/updated data into cache after a write
  optimisticUpdate: (collectionName: string, updatedItem: any, idField?: string) => void;
  // Invalidate ETag for a collection to force a full re-fetch on next poll
  invalidateETag: (collectionName: string) => void;
  // Clear active in-memory subscriptions when the authenticated account changes.
  clearSession: () => void;
  // Get current data for a collection
  getData: (collectionName: string) => any[];
  // Get loading state
  isLoading: (collectionName: string) => boolean;
  // Get error state
  getError: (collectionName: string) => string | null;
}

const CACHE_PREFIX = 'sync_cache_';
// Keep data current without continuously triggering authenticated browser
// requests (and their CORS preflights) while a vendor screen is open.
const POLL_INTERVAL_MS = 30000;
const UNSUBSCRIBE_GRACE_PERIOD_MS = 15000;
const REALTIME_DEBUG = __DEV__ || process.env.EXPO_PUBLIC_API_DEBUG === 'true';

// ─── Collection-to-fetcher mapping ───
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
  fuelRecords: api.fetchFuelRecords,
  uploads: api.fetchUploads,
  customers: api.fetchCustomers,
  fuelStations: api.fetchFuelStations,
  users: api.fetchUsers,
  roles: api.fetchRoles,
};

// ─── ETag store for 304 support ───
const etagStore: Record<string, string> = {};
const inFlightFetches = new Map<string, Promise<{ data: any[]; hash: string; notModified: boolean; failed: boolean }>>();
let sessionScope = 'anonymous';

/** Namespaces every persisted cache by user, preventing data leakage on account switching. */
export function setRealtimeSessionScope(uid?: string): void {
  sessionScope = uid || 'anonymous';
}

export function getRealtimeCollectionKey(collectionName: string, params?: Record<string, string>): string {
  const filterKey = params
    ? '_' + Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}_${v}`).join('_')
    : '';
  return CACHE_PREFIX + sessionScope + '_' + collectionName + filterKey;
}

function getCollectionKeyPrefix(collectionName: string): string {
  return `${CACHE_PREFIX}${sessionScope}_${collectionName}`;
}

/**
 * Fetch from the API with ETag support.
 * Returns { data, hash, notModified }.
 */
async function requestWithETag(
  collectionName: string,
  params?: Record<string, string>
): Promise<{ data: any[]; hash: string; notModified: boolean; failed: boolean }> {
  const fetcher = fetchers[collectionName];
  if (!fetcher) {
    return { data: [], hash: '', notModified: false, failed: true };
  }

  try {
    // Use axios directly for ETag support
    const axios = (await import('axios')).default;
    const token = await (await import('../services/database')).getStoredToken();

    // Map collection names to API paths
    const pathMap: Record<string, string> = {
      vendors: '/api/vendors',
      drivers: '/api/drivers',
      vehicles: '/api/vehicles',
      materials: '/api/materials',
      purchaseOrders: '/api/purchase-orders',
      deliveryOrders: '/api/delivery-orders',
      weighRecords: '/api/weighbridge',
      checkpoints: '/api/checkpoints',
      quarries: '/api/quarries',
      sites: '/api/sites',
      fuelRecords: '/api/fuel',
      uploads: '/api/uploads',
      customers: '/api/customers',
      fuelStations: '/api/fuel-stations',
      users: '/api/users',
      roles: '/api/roles',
    };

    const url = pathMap[collectionName] || `/api/${collectionName}`;
    const etagKey = getRealtimeCollectionKey(collectionName, params);
    const prevETag = etagStore[etagKey] || '';

    // GETs have no body. Keep their headers minimal; the server's no-store
    // response policy and the in-memory ETag cache handle freshness.
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (prevETag) {
      headers['If-None-Match'] = prevETag;
    }


    const response = await axios.get(url, {
      baseURL: API_BASE_URL,
      params,
      headers,
      timeout: 10000,
      validateStatus: (status: number) => status === 200 || status === 304,
    });

    // 304 Not Modified — data hasn't changed
    if (response.status === 304) {
      return { data: [], hash: prevETag, notModified: true, failed: false };
    }

    // Store ETag for next request
    const newETag = response.headers['etag'] || '';
    if (newETag) {
      etagStore[etagKey] = newETag;
    } else {
      // The current API deliberately disables ETags for authenticated live
      // collections. Drop a value retained by an older app session so later
      // polls do not keep issuing conditional requests.
      delete etagStore[etagKey];
    }

    // Keep API fallback and real-time polling on one normalized collection
    // shape. This also accepts named envelopes such as `{ drivers: [] }`.
    const items = api.normalizeCollection(response.data, collectionName);
    if (REALTIME_DEBUG) {
      console.debug(`[RealtimeSync] ${collectionName} GET ${response.status} -> ${items.length} records`, {
        cacheControl: response.headers['cache-control'],
      });
    }

    return { data: items, hash: newETag, notModified: false, failed: false };
  } catch (error: any) {
    if (REALTIME_DEBUG) {
      console.debug(`[RealtimeSync] ${collectionName} request failed`, {
        status: error?.response?.status,
        message: error?.message,
      });
    }
    return { data: [], hash: '', notModified: false, failed: true };
  }
}

/** Deduplicate concurrent polls, pull-to-refresh actions, and duplicate mounts. */
async function fetchWithETag(
  collectionName: string,
  params?: Record<string, string>
): Promise<{ data: any[]; hash: string; notModified: boolean; failed: boolean }> {
  const key = getRealtimeCollectionKey(collectionName, params);
  const activeRequest = inFlightFetches.get(key);
  if (activeRequest) return activeRequest;

  const request = requestWithETag(collectionName, params).finally(() => {
    inFlightFetches.delete(key);
  });
  inFlightFetches.set(key, request);
  return request;
}

/**
 * On web, one EventSource receives server-side Firestore onSnapshot change
 * signals. It does not transfer collection data or issue polling reads; the
 * normal authenticated request runs only after an actual delivery change.
 */
function startDeliveryOrderLiveSync(onChange: () => Promise<void>): () => void {
  const EventSourceClass = (globalThis as any).EventSource;
  if (!EventSourceClass) return () => {};

  const stream = new EventSourceClass(`${API_BASE_URL}/api/sync/stream`);
  const handleChange = () => {
    if (REALTIME_DEBUG) console.debug('[RealtimeSync] deliveryOrders snapshot change received');
    void onChange();
  };

  stream.addEventListener('deliveryOrders', handleChange);
  return () => {
    stream.removeEventListener('deliveryOrders', handleChange);
    stream.close();
  };
}

/**
 * Load cached data from SecureStore.
 */
async function loadCachedData(cacheKey: string): Promise<any[] | null> {
  try {
    const cached = await getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
    if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

/**
 * Save data to SecureStore cache.
 */
async function saveCachedData(cacheKey: string, data: any[]): Promise<void> {
  try {
    await setItem(cacheKey, JSON.stringify(data));
  } catch {}
}

// ─── Create Store ───
export const useRealTimeSyncStore = create<SyncState>((set, get) => ({
  collections: {},

  subscribe: (collectionName: string, params?: Record<string, string>) => {
    const cacheKey = getRealtimeCollectionKey(collectionName, params);
    const state = get();
    const existing = state.collections[cacheKey];

    if (existing) {
      if (existing.cleanupTimer) clearTimeout(existing.cleanupTimer);
      // Already subscribed — just increment count
      set({
        collections: {
          ...state.collections,
          [cacheKey]: {
            ...existing,
            subscribers: existing.subscribers + 1,
            cleanupTimer: null,
          },
        },
      });
      return;
    }

    // First-time subscription — start fresh
    set({
      collections: {
        ...state.collections,
        [cacheKey]: {
          data: [],
          hash: '',
          timestamp: 0,
          loading: true,
          error: null,
          subscribers: 1,
          pollInterval: null,
          cleanupTimer: null,
          liveSyncStop: null,
        },
      },
    });

    // Load cached data instantly
    loadCachedData(cacheKey).then((cached) => {
      const current = get().collections[cacheKey];
      // Do not let a slow SecureStore read overwrite a response that arrived
      // from the server first.
      if (current && cached && current.timestamp === 0) {
        set({
          collections: {
            ...get().collections,
            [cacheKey]: {
              ...current,
              data: cached,
              loading: false,
            },
          },
        });
      }
    });

    // Define poll function
    const doPoll = async () => {
      const current = get().collections[cacheKey];
      if (!current || current.subscribers <= 0) return;

      let result = await fetchWithETag(collectionName, params);

      // Re-read the latest collection data after the async fetch. The cached
      // payload may have been populated by loadCachedData while the request
      // was in-flight, so `current.data.length` is stale.
      const latest = get().collections[cacheKey];
      const latestDataLength = latest?.data?.length ?? 0;

      // A 304 cannot rebuild an empty collection, so fetch once more without
      // the conditional ETag when the in-memory array is still empty.
      if (result.notModified && latestDataLength === 0) {
        delete etagStore[cacheKey];
        result = await fetchWithETag(collectionName, params);
      }

      if (result.notModified) {
        const cur = get().collections[cacheKey];
        if (cur) {
          set({
            collections: {
              ...get().collections,
              [cacheKey]: {
                ...cur,
                loading: false,
                timestamp: Date.now(),
                error: null,
              },
            },
          });
        }
        return;
      }

      if (!result.failed) {
        // New data received
        saveCachedData(cacheKey, result.data);
        const cur = get().collections[cacheKey];
        if (cur) {
          set({
            collections: {
              ...get().collections,
              [cacheKey]: {
                ...cur,
                data: result.data,
                hash: result.hash,
                timestamp: Date.now(),
                loading: false,
                error: null,
              },
            },
          });
        }
      } else {
        const cur = get().collections[cacheKey];
        if (cur) {
          set({
            collections: {
              ...get().collections,
              [cacheKey]: {
                ...cur,
                loading: false,
                error: 'Unable to refresh data',
              },
            },
          });
        }
      }
    };

    // Initial fetch immediately
    doPoll();

    // Start polling interval
    const interval = setInterval(doPoll, POLL_INTERVAL_MS);
    const liveSyncStop = collectionName === 'deliveryOrders'
      ? startDeliveryOrderLiveSync(doPoll)
      : null;
    set({
      collections: {
        ...get().collections,
        [cacheKey]: {
          ...get().collections[cacheKey],
          pollInterval: interval,
          liveSyncStop,
        },
      },
    });
  },

  unsubscribe: (collectionName: string, params?: Record<string, string>) => {
    const cacheKey = getRealtimeCollectionKey(collectionName, params);
    const state = get();
    const existing = state.collections[cacheKey];
    if (!existing) return;
    if (existing.subscribers <= 0) return;

    const newCount = Math.max(0, existing.subscribers - 1);
    if (newCount <= 0) {
      // Last subscriber — clean up
      const cleanupTimer = setTimeout(() => {
        const latest = get().collections[cacheKey];
        if (!latest || latest.subscribers > 0) return;
        if (latest.pollInterval) clearInterval(latest.pollInterval);
        latest.liveSyncStop?.();
        delete etagStore[cacheKey];
        const { [cacheKey]: _removed, ...rest } = get().collections;
        set({ collections: rest });
        if (REALTIME_DEBUG) console.debug(`[RealtimeSync] released ${collectionName}`);
      }, UNSUBSCRIBE_GRACE_PERIOD_MS);
      // The collection data is being removed. Keeping its ETag would make a
      // later mount receive a 304 with no in-memory data, then force a second
      // full request to rebuild the cache.
      set({
        collections: {
          ...state.collections,
          [cacheKey]: { ...existing, subscribers: 0, cleanupTimer },
        },
      });
    } else {
      set({
        collections: {
          ...state.collections,
          [cacheKey]: {
            ...existing,
            subscribers: newCount,
          },
        },
      });
    }
  },

  refresh: async (collectionName: string, params?: Record<string, string>) => {
    const cacheKey = getRealtimeCollectionKey(collectionName, params);
    const state = get();
    const existing = state.collections[cacheKey];
    if (!existing) return;

    // Clear only this scoped/filter ETag. Keep data visible during refresh.
    delete etagStore[cacheKey];

    set({
      collections: {
        ...state.collections,
        [cacheKey]: {
          ...existing,
          loading: true,
        },
      },
    });

    let result = await fetchWithETag(collectionName, params);
    if (result.notModified && existing.data.length === 0) {
      delete etagStore[cacheKey];
      result = await fetchWithETag(collectionName, params);
    }

    if (result.notModified) {
      const current = get().collections[cacheKey];
      if (current) {
        set({
          collections: {
            ...get().collections,
            [cacheKey]: {
              ...current,
              loading: false,
              timestamp: Date.now(),
              error: null,
            },
          },
        });
      }
      return;
    }

    if (!result.failed) {
      saveCachedData(cacheKey, result.data);
      set({
        collections: {
          ...get().collections,
          [cacheKey]: {
            ...get().collections[cacheKey],
            data: result.data,
            hash: result.hash,
            timestamp: Date.now(),
            loading: false,
            error: null,
          },
        },
      });
    } else {
      set({
        collections: {
          ...get().collections,
          [cacheKey]: {
            ...get().collections[cacheKey],
            loading: false,
            error: 'Failed to refresh',
          },
        },
      });
    }
  },

  getData: (collectionName: string) => {
    const state = get();
    // Find all cache entries for this collection and return the first with data
    for (const key of Object.keys(state.collections)) {
      if (key.startsWith(getCollectionKeyPrefix(collectionName))) {
        const entry = state.collections[key];
        if (entry.data.length > 0) return entry.data;
      }
    }
    // Fallback: find any entry (even empty) for this collection
    for (const key of Object.keys(state.collections)) {
      if (key.startsWith(getCollectionKeyPrefix(collectionName))) {
        return state.collections[key].data;
      }
    }
    return [];
  },

  isLoading: (collectionName: string) => {
    const state = get();
    for (const key of Object.keys(state.collections)) {
      if (key.startsWith(getCollectionKeyPrefix(collectionName))) {
        return state.collections[key].loading;
      }
    }
    return false;
  },

  optimisticUpdate: (collectionName: string, updatedItem: any, idField?: string) => {
    const state = get();
    const idKey = idField || 'id';
    const updatedId = updatedItem[idKey] ?? updatedItem.jobId ?? '';
    if (!updatedId) return;

    // Update all cache entries for this collection
    const newCollections = { ...state.collections };
    for (const key of Object.keys(newCollections)) {
      if (key.startsWith(getCollectionKeyPrefix(collectionName))) {
        const entry = newCollections[key];
        const existingIndex = entry.data.findIndex(
          (item: any) => (item[idKey] ?? item.jobId ?? '') === updatedId
        );
        let newData: any[];
        if (existingIndex >= 0) {
          newData = [...entry.data];
          newData[existingIndex] = { ...newData[existingIndex], ...updatedItem };
        } else {
          newData = [updatedItem, ...entry.data];
        }
        newCollections[key] = { ...entry, data: newData };
        // Persist to SecureStore
        const cacheKey = key;
        saveCachedData(cacheKey, newData);
      }
    }
    set({ collections: newCollections });
  },

  getError: (collectionName: string) => {
    const state = get();
    for (const key of Object.keys(state.collections)) {
      if (key.startsWith(getCollectionKeyPrefix(collectionName))) {
        return state.collections[key].error;
      }
    }
    return null;
  },

  invalidateETag: (collectionName: string) => {
    Object.keys(etagStore).filter((key) => key.includes(`_${collectionName}`)).forEach((key) => delete etagStore[key]);
  },

  clearSession: () => {
    const state = get();
    Object.values(state.collections).forEach((entry) => {
      if (entry.pollInterval) clearInterval(entry.pollInterval);
      if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
      entry.liveSyncStop?.();
    });
    Object.keys(etagStore).forEach((key) => delete etagStore[key]);
    set({ collections: {} });
  },
}));
