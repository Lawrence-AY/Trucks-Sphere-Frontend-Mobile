/**
 * BaseRepository - Generic CRUD repository with cache-first strategy
 *
 * Architecture:
 *   Screen → Repository → Cache → API
 *
 * Flow:
 *   1. Return cached data instantly (0ms)
 *   2. Fetch from API in background
 *   3. Update cache on success
 *   4. Notify listeners of changes
 *
 * All repositories extend this base class.
 */

import { collectionCache } from '../cache/CollectionCache';
import api from '../api';
import { getStoredToken } from '../database';

export interface RepositoryConfig {
  name: string;           // Collection name (e.g., 'vendors')
  apiPath: string;        // API path (e.g., '/api/vendors')
  cacheKey: string;       // Cache key prefix
}

export class BaseRepository<T extends { id: string }> {
  protected config: RepositoryConfig;

  constructor(config: RepositoryConfig) {
    this.config = config;
  }

  /**
   * Get all items with optional filters.
   * Returns cached data instantly, refreshes in background.
   */
  async getAll(params?: Record<string, string>): Promise<T[]> {
    // 1. Try cache first
    const cached = await collectionCache.getCollection<T>(this.config.cacheKey, params);
    if (cached.length > 0) {
      // Background refresh
      this.fetchAndCache(params).catch(() => {});
      return cached;
    }

    // 2. Fetch from API
    return this.fetchAndCache(params);
  }

  /**
   * Get a single item by ID.
   */
  async getById(id: string): Promise<T | null> {
    // Try to find in cached collection first
    const all = await collectionCache.getCollection<T>(this.config.cacheKey);
    const found = all.find((item) => item.id === id);
    if (found) return found;

    // Fetch from API
    try {
      const response = await api.get(`${this.config.apiPath}/${id}`);
      return response.data as T;
    } catch {
      return null;
    }
  }

  /**
   * Create a new item.
   * Performs optimistic update: adds to cache immediately, syncs in background.
   */
  async create(data: Partial<T>): Promise<T> {
    // Optimistic: add to cache immediately
    const optimisticItem = {
      ...data,
      id: `temp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      createdBy: 'current_user',
    } as unknown as T;

    await collectionCache.addToCollection(this.config.cacheKey, optimisticItem);

    try {
      const response = await api.post(this.config.apiPath, data);
      const createdItem = response.data as T;

      // Replace optimistic item with real one
      await collectionCache.updateInCollection(
        this.config.cacheKey,
        optimisticItem.id,
        createdItem
      );

      return createdItem;
    } catch (error) {
      // Rollback optimistic update
      await collectionCache.removeFromCollection(this.config.cacheKey, optimisticItem.id);
      throw error;
    }
  }

  /**
   * Update an existing item.
   * Performs optimistic update.
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    // Optimistic update
    await collectionCache.updateInCollection(this.config.cacheKey, id, updates);

    try {
      const response = await api.put(`${this.config.apiPath}/${id}`, updates);
      return response.data as T;
    } catch (error) {
      // Rollback by invalidating cache (will re-fetch)
      collectionCache.invalidateCollection(this.config.cacheKey);
      throw error;
    }
  }

  /**
   * Delete an item (soft delete by default).
   */
  async delete(id: string): Promise<void> {
    // Optimistic remove
    await collectionCache.removeFromCollection(this.config.cacheKey, id);

    try {
      await api.delete(`${this.config.apiPath}/${id}`);
    } catch (error) {
      // Rollback
      collectionCache.invalidateCollection(this.config.cacheKey);
      throw error;
    }
  }

  /**
   * Search items by query.
   */
  async search(query: string): Promise<T[]> {
    return this.getAll({ search: query });
  }

  /**
   * Listen for changes to this collection.
   */
  onChange(listener: (action: 'create' | 'update' | 'delete', item: any) => void): () => void {
    return collectionCache.onChange(this.config.cacheKey, (_, action, item) => {
      listener(action, item);
    });
  }

  /**
   * Invalidate the cache for this collection.
   */
  invalidateCache(params?: Record<string, string>): void {
    collectionCache.invalidateCollection(this.config.cacheKey, params);
  }

  /**
   * Fetch from API and update cache.
   */
  private async fetchAndCache(params?: Record<string, string>): Promise<T[]> {
    try {
      const response = await api.get(this.config.apiPath, params);

      let items: T[] = [];
      const data = response.data;
      if (Array.isArray(data)) {
        items = data;
      } else if (data?.items) {
        items = data.items;
      } else if (data?.data) {
        items = data.data;
      }

      // Update cache
      await collectionCache.setCollection(this.config.cacheKey, items, params);
      return items;
    } catch (error) {
      console.warn(`[${this.config.name}] Fetch failed:`, error);
      return [];
    }
  }
}
