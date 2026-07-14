/**
 * DriverRepository - Manages Drivers
 *
 * Drivers belong to Vendors and can be assigned to Vehicles.
 */

import { BaseRepository } from './BaseRepository';
import { Driver } from '../../store/types';
import api from '../api';
import { getStoredToken } from '../database';

class DriverRepository extends BaseRepository<Driver> {
  constructor() {
    super({
      name: 'drivers',
      apiPath: '/api/drivers',
      cacheKey: 'drivers',
    });
  }

  /**
   * Get drivers by vendor.
   */
  async getByVendor(vendorId: string): Promise<Driver[]> {
    return this.getAll({ vendorId });
  }

  /**
   * Get available drivers (not on trip).
   */
  async getAvailable(): Promise<Driver[]> {
    return this.getAll({ status: 'active', availability: 'true' });
  }

  /**
   * Assign a driver to a vehicle.
   */
  async assignVehicle(driverId: string, vehicleId: string, plateNumber: string): Promise<Driver> {
    return this.update(driverId, {
      currentVehicleId: vehicleId,
      currentVehiclePlate: plateNumber,
    } as any);
  }

  /**
   * Unassign a driver from their current vehicle.
   */
  async unassignVehicle(driverId: string): Promise<Driver> {
    return this.update(driverId, {
      currentVehicleId: undefined,
      currentVehiclePlate: undefined,
    } as any);
  }

  /**
   * Update driver availability.
   */
  async setAvailability(driverId: string, available: boolean): Promise<Driver> {
    return this.update(driverId, { availability: available } as any);
  }

  /**
   * Get driver trip history.
   */
  async getHistory(driverId: string): Promise<any[]> {
    try {
      const token = await getStoredToken();
      const response = await api.get(`/api/drivers/${driverId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      return Array.isArray(data) ? data : data?.items || data?.data || [];
    } catch {
      return [];
    }
  }
}

export const driverRepository = new DriverRepository();
