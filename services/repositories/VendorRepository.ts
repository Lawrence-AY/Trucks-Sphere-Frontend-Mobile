/**
 * VendorRepository - Manages Vendors, Drivers, and Vehicles
 *
 * Vendors own:
 *   - Drivers
 *   - Vehicles
 *   - Documents
 *   - Performance metrics
 */

import { BaseRepository } from './BaseRepository';
import { Vendor, Driver, Vehicle } from '@/store/types';
import api from '../api';
import { getStoredToken } from '../database';
import { collectionCache } from '../cache/CollectionCache';
import { useRealTimeSyncStore } from '@/store/realTimeSyncStore';

class VendorRepository extends BaseRepository<Vendor> {
  constructor() {
    super({
      name: 'vendors',
      apiPath: '/api/vendors',
      cacheKey: 'vendors',
    });
  }

  private async publishCreatedVendor(vendor: Vendor): Promise<void> {
    // The repository cache serves the driver/truck forms, while the Zustand
    // cache serves the rest of the app. Publish to both immediately instead
    // of waiting for the 30-second collection poll or Firestore snapshot.
    await collectionCache.addToCollection(this.config.cacheKey, vendor);
    useRealTimeSyncStore.getState().optimisticUpdate('vendors', vendor);
  }

  override async create(data: Partial<Vendor>): Promise<Vendor> {
    const vendor = await super.create(data);
    useRealTimeSyncStore.getState().optimisticUpdate('vendors', vendor);
    return vendor;
  }

  /** Create a vendor and its login account, then publish it to local lists. */
  async createWithAccount(payload: { vendor: Partial<Vendor>; account: { email: string; password: string; isActive: boolean } }) {
    const response = await api.post('/api/vendors/with-account', payload);
    const result = response.data as { vendor: Vendor; user: unknown; username: string };
    if (!result || typeof result !== 'object' || !result.vendor?.id || !result.username) {
      throw new Error('The server did not confirm the vendor login account. Check the Vendors list before retrying.');
    }
    await this.publishCreatedVendor(result.vendor);
    return result;
  }

  /**
   * Get drivers for a specific vendor.
   * Passes vendorId as a top-level query parameter so the backend
   * can filter via req.query.vendorId.
   */
  async getDrivers(vendorId: string): Promise<Driver[]> {
    try {
      const response = await api.get('/api/drivers', { vendorId });
      const data = response.data;
      return Array.isArray(data) ? data : data?.items || data?.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Get vehicles for a specific vendor.
   * Passes vendorId as a top-level query parameter so the backend
   * can filter via req.query.vendorId.
   */
  async getVehicles(vendorId: string): Promise<Vehicle[]> {
    try {
      const response = await api.get('/api/vehicles', { vendorId });
      const data = response.data;
      return Array.isArray(data) ? data : data?.items || data?.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Create a driver under a vendor.
   */
  async createDriver(vendorId: string, data: Partial<Driver>): Promise<Driver> {
    const response = await api.post('/api/drivers', {
      ...data,
      vendorId,
    });
    return response.data as Driver;
  }

  /**
   * Create a vehicle under a vendor.
   */
  async createVehicle(vendorId: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const response = await api.post('/api/vehicles', {
      ...data,
      vendorId,
    });
    return response.data as Vehicle;
  }

  /**
   * Get vendor performance metrics.
   */
  async getPerformance(vendorId: string): Promise<any> {
    try {
      const token = await getStoredToken();
      const response = await api.get(`/api/vendors/${vendorId}/performance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Get vendor documents.
   * Gracefully skips API call for fallback/invalid vendor IDs.
   */
  async getDocuments(vendorId: string): Promise<any[]> {
    // Skip invalid / fallback vendor IDs to avoid 404 errors
    if (!vendorId || vendorId.length < 3) {
      return [];
    }
    try {
      const token = await getStoredToken();
      const response = await api.get(`/api/vendors/${vendorId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      return Array.isArray(data) ? data : data?.items || data?.data || [];
    } catch {
      return [];
    }
  }
}

export const vendorRepository = new VendorRepository();
