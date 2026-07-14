/**
 * CacheManager - Local-first caching layer for TruckSphere
 *
 * Architecture:
 *   Screen → Repository → CacheManager → API
 *                            ↓
 *                      SecureStore/AsyncStorage
 *
 * Strategy:
 *   - Return cached data instantly (0ms)
 *   - Fetch from API in background
 *   - Update cache on successful response
 *   - Stale-while-revalidate pattern
 *   - Optimistic updates for mutations
 */

import { setItem, getItem, removeItem } from '../database';

const CACHE_PREFIX = 'ts_cache_';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private pendingWrites: Map<string, Promise<void>> = new Map();

  /**
   * Get data from cache. Returns null if not found or expired.
   * Checks memory cache first, then persistent storage.
   */
  async get<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): Promise<T | null> {
    // 1. Check memory cache
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry, ttlMs)) {
      return memEntry.data as T;
    }

    // 2. Check persistent cache
    try {
      const stored = await getItem(CACHE_PREFIX + key);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (!this.isExpired(entry, ttlMs)) {
          // Warm memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        }
      }
    } catch {
      // Ignore cache read errors
    }

    return null;
  }

  /**
   * Set data in both memory and persistent cache.
   */
  async set<T>(key: string, data: T, etag?: string): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: DEFAULT_TTL_MS,
      etag,
    };

    // Memory cache
    this.memoryCache.set(key, entry);

    // Persistent cache (debounced to avoid write storms)
    const cacheKey = CACHE_PREFIX + key;
    const existingWrite = this.pendingWrites.get(cacheKey);
    const writeOp = (existingWrite || Promise.resolve()).then(() =>
      setItem(cacheKey, JSON.stringify(entry)).catch(() => {})
    );
    this.pendingWrites.set(cacheKey, writeOp);
  }

  /**
   * Remove an entry from both caches.
   */
  async remove(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await removeItem(CACHE_PREFIX + key);
    } catch {
      // Ignore
    }
  }

  /**
   * Clear all cached data.
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    // Note: We can't easily clear all prefixed keys from SecureStore,
    // but we can clear the memory cache which is the primary fast path.
  }

  /**
   * Invalidate a specific cache entry (force next fetch).
   */
  invalidate(key: string): void {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.timestamp = 0; // Force expiry
    }
  }

  /**
   * Get the ETag for a cached entry, if available.
   */
  getEtag(key: string): string | undefined {
    const entry = this.memoryCache.get(key);
    return entry?.etag;
  }

  /**
   * Check if a cache entry is expired.
   */
  private isExpired(entry: CacheEntry<any>, ttlMs: number): boolean {
    return Date.now() - entry.timestamp > ttlMs;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();
