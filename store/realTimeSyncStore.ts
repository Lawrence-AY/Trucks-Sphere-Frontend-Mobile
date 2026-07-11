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

// ─── Types ───
interface CollectionEntry {
  data: any[];
  hash: string;          // ETag value from server
  timestamp: number;      // Last successful fetch time
  loading: boolean;
  error: string | null;
  subscribers: number;    // How many components are using this
  pollInterval: ReturnType<typeof setInterval> | null;
}

interface SyncState {
  collections: Record<string, CollectionEntry>;
  // Subscribe to a collection — returns current data
  subscribe: (collectionName: string, params?: Record<string, string>) => void;
  // Unsubscribe from a collection
  unsubscribe: (collectionName: string, params?: Record<string, string>) => void;
  // Force refresh a collection
  refresh: (collectionName: string, params?: Record<string, string>) => Promise<void>;
  // Get current data for a collection
  getData: (collectionName: string) => any[];
  // Get loading state
  isLoading: (collectionName: string) => boolean;
  // Get error state
  getError: (collectionName: string) => string | null;
}

const CACHE_PREFIX = 'sync_cache_';
const POLL_INTERVAL_MS = 30000; // 30 seconds

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
};

// ─── ETag store for 304 support ───
const etagStore: Record<string, string> = {};

function buildCacheKey(collectionName: string, params?: Record<string, string>): string {
  const filterKey = params
    ? '_' + Object.entries(params).map(([k, v]) => `${k}_${v}`).join('_')
    : '';
  return CACHE_PREFIX + collectionName + filterKey;
}

/**
 * Fetch from the API with ETag support.
 * Returns { data, hash, notModified }.
 */
async function fetchWithETag(
  collectionName: string,
  params?: Record<string, string>
): Promise<{ data: any[]; hash: string; notModified: boolean }> {
  const fetcher = fetchers[collectionName];
  if (!fetcher) {
    console.warn(`[Sync] Unknown collection: ${collectionName}`);
    return { data: [], hash: '', notModified: false };
  }

  try {
    // Use axios directly for ETag support
    const axios = (await import('axios')).default;
    const token = await (await import('../services/database')).getStoredToken();

    const baseUrl = (() => {
      const { Platform } = require('react-native');
      if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
      if (process.env.EXPO_PUBLIC_API_IP) return `http://${process.env.EXPO_PUBLIC_API_IP}:5000`;
      if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
      return 'http://192.168.1.211:5000';
    })();

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
    };

    const url = pathMap[collectionName] || `/api/${collectionName}`;
    const prevETag = etagStore[collectionName] || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (prevETag) {
      headers['If-None-Match'] = prevETag;
    }

    console.log(`[Sync] Fetching ${collectionName}${prevETag ? ' (with ETag)' : ''}...`);

    const response = await axios.get(url, {
      baseURL: baseUrl,
      params,
      headers,
      timeout: 10000,
      validateStatus: (status: number) => status === 200 || status === 304,
    });

    // 304 Not Modified — data hasn't changed
    if (response.status === 304) {
      console.log(`[Sync] ${collectionName} not modified (304)`);
      return { data: [], hash: prevETag, notModified: true };
    }

    // Store ETag for next request
    const newETag = response.headers['etag'] || '';
    if (newETag) {
      etagStore[collectionName] = newETag;
    }

    // Unwrap data
    const rawData = response.data;
    let items: any[] = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (Array.isArray(rawData?.data)) {
      items = rawData.data;
    } else if (Array.isArray(rawData?.items)) {
      items = rawData.items;
    } else if (Array.isArray(rawData?.results)) {
      items = rawData.results;
    }

    console.log(`[Sync] ${collectionName} fetched: ${items.length} items`);
    return { data: items, hash: newETag, notModified: false };
  } catch (error: any) {
    console.warn(`[Sync] ${collectionName} fetch error:`, error?.message || error);
    return { data: [], hash: '', notModified: false };
  }
}

/**
 * Load cached data from SecureStore.
 */
async function loadCachedData(cacheKey: string): Promise<any[] | null> {
  try {
    const cached = await getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
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
    const cacheKey = buildCacheKey(collectionName, params);
    const state = get();
    const existing = state.collections[cacheKey];

    if (existing) {
      // Already subscribed — just increment count
      set({
        collections: {
          ...state.collections,
          [cacheKey]: {
            ...existing,
            subscribers: existing.subscribers + 1,
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
        },
      },
    });

    // Load cached data instantly
    loadCachedData(cacheKey).then((cached) => {
      const current = get().collections[cacheKey];
      if (current && cached) {
        set({
          collections: {
            ...get().collections,
            [cacheKey]: {
              ...current,
              data: cached,
            },
          },
        });
      }
    });

    // Define poll function
    const doPoll = async () => {
      const current = get().collections[cacheKey];
      if (!current || current.subscribers <= 0) return;

      const result = await fetchWithETag(collectionName, params);

      if (result.notModified) {
        // Data unchanged — just update timestamp, keep existing data
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

      if (result.data.length > 0) {
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
        // Empty response — mark as loaded
        const cur = get().collections[cacheKey];
        if (cur) {
          set({
            collections: {
              ...get().collections,
              [cacheKey]: {
                ...cur,
                loading: false,
                error: null,
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
    set({
      collections: {
        ...get().collections,
        [cacheKey]: {
          ...get().collections[cacheKey],
          pollInterval: interval,
        },
      },
    });
  },

  unsubscribe: (collectionName: string, params?: Record<string, string>) => {
    const cacheKey = buildCacheKey(collectionName, params);
    const state = get();
    const existing = state.collections[cacheKey];
    if (!existing) return;

    const newCount = existing.subscribers - 1;
    if (newCount <= 0) {
      // Last subscriber — clean up
      if (existing.pollInterval) {
        clearInterval(existing.pollInterval);
      }
      const { [cacheKey]: _removed, ...rest } = state.collections;
      set({ collections: rest });
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
    const cacheKey = buildCacheKey(collectionName, params);
    const state = get();
    const existing = state.collections[cacheKey];
    if (!existing) return;

    // Clear ETag to force full re-fetch
    delete etagStore[collectionName];

    set({
      collections: {
        ...state.collections,
        [cacheKey]: {
          ...existing,
          loading: true,
        },
      },
    });

    const result = await fetchWithETag(collectionName, params);
    if (result.data.length > 0) {
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
            error: result.notModified ? null : 'Failed to refresh',
          },
        },
      });
    }
  },

  getData: (collectionName: string) => {
    const state = get();
    // Find all cache entries for this collection and return the first with data
    for (const key of Object.keys(state.collections)) {
      if (key.startsWith(CACHE_PREFIX + collectionName)) {
        const entry = state.collections[key];
        if (entry.data.length > 0) return entry.data;
      }
    }
    // Fallback: find any entry (even empty) for this collection
    for (const key of Object.keys(state.collections)) {
      if (key.startsWith(CACHE_PREFIX + collectionName)) {
        return state.collections[key].data;
      }
    }
    return [];
  },

  isLoading: (collectionName: string) => {
    const state = get();
    for (const key of Object.keys(state.collections)) {
      if (key.startsWith(CACHE_PREFIX + collectionName)) {
        return state.collections[key].loading;
      }
    }
    return false;
  },

  getError: (collectionName: string) => {
    const state = get();
    for (const key of Object.keys(state.collections)) {
      if (key.startsWith(CACHE_PREFIX + collectionName)) {
        return state.collections[key].error;
      }
    }
    return null;
  },
}));