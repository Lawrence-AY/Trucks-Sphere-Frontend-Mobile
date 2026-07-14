/**
 * MaterialRepository - Manages Materials, Categories, and Measurement Units
 *
 * Supports dynamic material properties for dynamic dispatch forms.
 */

import { BaseRepository } from './BaseRepository';
import { Material } from '../../store/types';
import api from '../api';
import { getStoredToken } from '../database';

class MaterialRepository extends BaseRepository<Material> {
  constructor() {
    super({
      name: 'materials',
      apiPath: '/api/materials',
      cacheKey: 'materials',
    });
  }

  /**
   * Get materials by category.
   */
  async getByCategory(category: string): Promise<Material[]> {
    return this.getAll({ category });
  }

  /**
   * Get active materials only.
   */
  async getActive(): Promise<Material[]> {
    return this.getAll({ status: 'active' });
  }

  /**
   * Get material categories.
   */
  async getCategories(): Promise<string[]> {
    try {
      const token = await getStoredToken();
      const response = await api.get('/api/materials/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      return Array.isArray(data) ? data : data?.categories || [];
    } catch {
      return ['Aggregates', 'Steel', 'Cement', 'Liquid', 'Blocks', 'Other'];
    }
  }

  /**
   * Get measurement units.
   */
  async getMeasurementUnits(): Promise<string[]> {
    try {
      const token = await getStoredToken();
      const response = await api.get('/api/materials/units', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      return Array.isArray(data) ? data : data?.units || [];
    } catch {
      return ['Tonnes', 'Bags', 'Pieces', 'Millimetres', 'Metres', 'Litres', 'Cubic Metres', 'Kilograms'];
    }
  }

  /**
   * Get the display fields for a material (for dynamic forms).
   * Returns what fields to show when dispatching this material.
   */
  getMaterialDisplayFields(material: Material): { quantityLabel: string; showDiameter: boolean; diameterOptions?: string[] } {
    switch (material.category) {
      case 'Cement':
        return { quantityLabel: 'Quantity (Bags)', showDiameter: false };
      case 'Steel':
        return {
          quantityLabel: 'Quantity (Pieces)',
          showDiameter: true,
          diameterOptions: material.diameterOptions || ['8mm', '10mm', '12mm', '16mm', '20mm', '25mm'],
        };
      case 'Aggregates':
        return { quantityLabel: 'Quantity (Tonnes)', showDiameter: false };
      case 'Liquid':
        return { quantityLabel: 'Quantity (Litres)', showDiameter: false };
      default:
        return { quantityLabel: `Quantity (${material.defaultUnit || 'units'})`, showDiameter: false };
    }
  }
}

export const materialRepository = new MaterialRepository();
