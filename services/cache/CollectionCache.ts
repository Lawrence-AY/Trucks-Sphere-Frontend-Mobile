/**
 * CollectionCache - Collection-specific caching with indexing
 *
 * Provides:
 *   - Cache collections by name with optional filter params
 *   - Index lookups (e.g., find all drivers for a vendor)
 *   - Optimistic update support
 *   - Change listeners for reactive UI
 */

import { cacheManager } from './CacheManager';

type ChangeListener = (collectionName: string, action: 'create' | 'update' | 'delete', item: any) => void;

export class CollectionCache {
  private listeners: Map<string, Set<ChangeListener>> = new Map();

  /**
   * Get a cached collection.
   */
  async getCollection<T>(name: string, params?: Record<string, string>): Promise<T[]> {
    const key = this.buildKey(name, params);
    return (await cacheManager.get<T[]>(key)) || [];
  }

  /**
   * Cache a collection.
   */
  async setCollection<T>(name: string, data: T[], params?: Record<string, string>, etag?: string): Promise<void> {
    const key = this.buildKey(name, params);
    await cacheManager.set(key, data, etag);
  }

  /**
   * Add an item to a cached collection (optimistic create).
   */
  async addToCollection<T extends { id: string }>(
    name: string,
    item: T,
    params?: Record<string, string>
  ): Promise<void> {
    const key = this.buildKey(name, params);
    const existing = await this.getCollection<T>(name, params);
    // Avoid duplicates
    if (!existing.find((i) => i.id === item.id)) {
      existing.unshift(item);
      await cacheManager.set(key, existing);
    }
    this.notifyListeners(name, 'create', item);
  }

  /**
   * Update an item in a cached collection (optimistic update).
   */
  async updateInCollection<T extends { id: string }>(
    name: string,
    itemId: string,
    updates: Partial<T>,
    params?: Record<string, string>
  ): Promise<void> {
    const key = this.buildKey(name, params);
    const existing = await this.getCollection<T>(name, params);
    const index = existing.findIndex((i) => i.id === itemId);
    if (index !== -1) {
      existing[index] = { ...existing[index], ...updates };
      await cacheManager.set(key, existing);
      this.notifyListeners(name, 'update', existing[index]);
    }
  }

  /**
   * Remove an item from a cached collection (optimistic delete).
   */
  async removeFromCollection(
    name: string,
    itemId: string,
    params?: Record<string, string>
  ): Promise<void> {
    const key = this.buildKey(name, params);
    const existing = await this.getCollection(name, params);
    const filtered = existing.filter((i: any) => i.id !== itemId);
    await cacheManager.set(key, filtered);
    this.notifyListeners(name, 'delete', { id: itemId });
  }

  /**
   * Invalidate a collection cache.
   */
  invalidateCollection(name: string, params?: Record<string, string>): void {
    const key = this.buildKey(name, params);
    cacheManager.invalidate(key);
  }

  /**
   * Listen for changes to a collection.
   * Returns an unsubscribe function.
   */
  onChange(name: string, listener: ChangeListener): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name)!.add(listener);
    return () => {
      this.listeners.get(name)?.delete(listener);
    };
  }

  /**
   * Notify listeners of a change.
   */
  private notifyListeners(name: string, action: 'create' | 'update' | 'delete', item: any): void {
    const listeners = this.listeners.get(name);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(name, action, item);
        } catch {
          // Ignore listener errors
        }
      });
    }
  }

  /**
   * Build a cache key from collection name and params.
   */
  private buildKey(name: string, params?: Record<string, string>): string {
    if (!params) return `col_${name}`;
    const sorted = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
    return `col_${name}_${sorted}`;
  }
}

export const collectionCache = new CollectionCache();
