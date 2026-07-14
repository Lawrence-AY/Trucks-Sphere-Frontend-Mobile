/**
 * VehicleRepository - Manages Vehicles
 *
 * Vehicles belong to Vendors and can have Drivers assigned.
 */

import { BaseRepository } from './BaseRepository';
import { Vehicle } from '../../store/types';
import api from '../api';
import { getStoredToken } from '../database';

class VehicleRepository extends BaseRepository<Vehicle> {
  constructor() {
    super({
      name: 'vehicles',
      apiPath: '/api/vehicles',
      cacheKey: 'vehicles',
    });
  }

  /**
   * Get vehicles by vendor.
   */
  async getByVendor(vendorId: string): Promise<Vehicle[]> {
    return this.getAll({ vendorId });
  }

  /**
   * Get active vehicles.
   */
  async getActive(): Promise<Vehicle[]> {
    return this.getAll({ status: 'active' });
  }

  /**
   * Get vehicles available for assignment (active and no driver).
   */
  async getAvailable(): Promise<Vehicle[]> {
    return this.getAll({ status: 'active', noDriver: 'true' });
  }

  /**
   * Assign a driver to this vehicle.
   */
  async assignDriver(vehicleId: string, driverId: string, driverName: string): Promise<Vehicle> {
    return this.update(vehicleId, {
      currentDriverId: driverId,
      currentDriverName: driverName,
    } as any);
  }

  /**
   * Unassign current driver.
   */
  async unassignDriver(vehicleId: string): Promise<Vehicle> {
    return this.update(vehicleId, {
      currentDriverId: undefined,
      currentDriverName: undefined,
    } as any);
  }

  /**
   * Update vehicle status.
   */
  async setStatus(vehicleId: string, status: Vehicle['status']): Promise<Vehicle> {
    return this.update(vehicleId, { status } as any);
  }

  /**
   * Get vehicle documents.
   */
  async getDocuments(vehicleId: string): Promise<any[]> {
    try {
      const token = await getStoredToken();
      const response = await api.get(`/api/vehicles/${vehicleId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      return Array.isArray(data) ? data : data?.items || data?.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Get vehicle history (jobs completed).
   */
  async getHistory(vehicleId: string): Promise<any[]> {
    try {
      const token = await getStoredToken();
      const response = await api.get(`/api/vehicles/${vehicleId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      return Array.isArray(data) ? data : data?.items || data?.data || [];
    } catch {
      return [];
    }
  }
}

export const vehicleRepository = new VehicleRepository();
