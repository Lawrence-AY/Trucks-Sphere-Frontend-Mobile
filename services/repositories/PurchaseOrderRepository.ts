/**
 * PurchaseOrderRepository - Manages Purchase Orders with workflow
 *
 * PO Status Workflow:
 *   Draft → Approved → Jobs Created → In Progress → Completed → Archived
 *                                                      ↓
 *                                                  Cancelled
 *
 * Delete = Cancel (soft delete sets status to 'cancelled')
 */

import { BaseRepository } from './BaseRepository';
import { PurchaseOrder } from '../../store/types';
import api from '../api';
import { getStoredToken } from '../database';

class PurchaseOrderRepository extends BaseRepository<PurchaseOrder> {
  constructor() {
    super({
      name: 'purchaseOrders',
      apiPath: '/api/purchase-orders',
      cacheKey: 'purchaseOrders',
    });
  }

  /**
   * Get POs by status.
   */
  async getByStatus(status: string): Promise<PurchaseOrder[]> {
    return this.getAll({ status });
  }

  /**
   * Get POs for a vendor.
   */
  async getByVendor(vendorId: string): Promise<PurchaseOrder[]> {
    return this.getAll({ vendorId });
  }

  /**
   * Approve a PO (Draft → Approved).
   */
  async approve(id: string, approvedBy: string): Promise<PurchaseOrder> {
    return this.update(id, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    } as any);
  }

  /**
   * Cancel a PO (any status → Cancelled).
   */
  async cancel(id: string): Promise<PurchaseOrder> {
    return this.update(id, { status: 'cancelled' } as any);
  }

  /**
   * Archive a PO (Completed → Archived).
   */
  async archive(id: string): Promise<PurchaseOrder> {
    return this.update(id, { status: 'archived' } as any);
  }

  /**
   * Soft delete - set status to cancelled.
   */
  async softDelete(id: string): Promise<PurchaseOrder> {
    return this.update(id, {
      status: 'cancelled',
      deletedAt: new Date().toISOString(),
    } as any);
  }

  /**
   * Get PO with delivery progress.
   */
  async getWithProgress(id: string): Promise<{ po: PurchaseOrder | null; delivered: number; remaining: number; jobCount: number }> {
    const po = await this.getById(id);
    if (!po) return { po: null, delivered: 0, remaining: 0, jobCount: 0 };

    try {
      const token = await getStoredToken();
      const response = await api.get('/api/delivery-orders', {
        params: { purchaseOrderId: id },
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      const jobs = Array.isArray(data) ? data : data?.items || data?.data || [];

      const delivered = jobs.reduce((sum: number, j: any) => sum + (j.quantityDelivered || 0), 0);
      return {
        po,
        delivered,
        remaining: Math.max(0, po.quantity - delivered),
        jobCount: jobs.length,
      };
    } catch {
      return { po, delivered: 0, remaining: po.quantity, jobCount: 0 };
    }
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
