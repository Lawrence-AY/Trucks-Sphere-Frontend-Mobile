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
import { Vendor, Driver, Vehicle } from '../../store/types';
import api from '../api';
import { getStoredToken } from '../database';

class VendorRepository extends BaseRepository<Vendor> {
  constructor() {
    super({
      name: 'vendors',
      apiPath: '/api/vendors',
      cacheKey: 'vendors',
    });
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
