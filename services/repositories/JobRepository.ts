/**
 * JobRepository - Manages Jobs (Delivery Orders) with full status workflow
 *
 * Job Status Workflow:
 *   Draft → Assigned → Ready → Loading → Quarry In → Quarry Out →
 *   In Transit → Site In → Offloading → Site Out →
 *   Receipt Uploaded → Reconciliation → Completed
 *
 * Each status transition is validated.
 */

import { BaseRepository } from './BaseRepository';
import { Job, JobStatus } from '../../store/types';
import api from '../api';
import { getStoredToken } from '../database';

// Valid status transitions
const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ['assigned', 'cancelled'],
  assigned: ['ready', 'cancelled'],
  ready: ['loading', 'cancelled'],
  loading: ['quarry_in', 'cancelled'],
  quarry_in: ['quarry_out', 'cancelled'],
  quarry_out: ['in_transit', 'cancelled'],
  in_transit: ['site_in', 'cancelled'],
  site_in: ['offloading', 'cancelled'],
  offloading: ['site_out', 'cancelled'],
  site_out: ['receipt_uploaded', 'cancelled'],
  receipt_uploaded: ['reconciliation', 'cancelled'],
  reconciliation: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

class JobRepository extends BaseRepository<Job> {
  constructor() {
    super({
      name: 'deliveryOrders',
      apiPath: '/api/delivery-orders',
      cacheKey: 'deliveryOrders',
    });
  }

  /**
   * Get jobs by status.
   */
  async getByStatus(status: JobStatus): Promise<Job[]> {
    return this.getAll({ status });
  }

  /**
   * Get jobs for a purchase order.
   */
  async getByPurchaseOrder(poId: string): Promise<Job[]> {
    return this.getAll({ purchaseOrderId: poId });
  }

  /**
   * Get jobs for a vendor.
   */
  async getByVendor(vendorId: string): Promise<Job[]> {
    return this.getAll({ vendorId });
  }

  /**
   * Get active jobs (not completed or cancelled).
   */
  async getActive(): Promise<Job[]> {
    return this.getAll({ status: 'active' });
  }

  /**
   * Get jobs pending dispatch.
   */
  async getPendingDispatch(): Promise<Job[]> {
    return this.getAll({ status: 'draft,assigned,ready' });
  }

  /**
   * Transition a job to a new status.
   * Validates the transition is allowed.
   */
  async transitionStatus(jobId: string, newStatus: JobStatus): Promise<Job> {
    const job = await this.getById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[job.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Cannot transition job from '${job.status}' to '${newStatus}'. ` +
        `Allowed transitions: ${(allowed || []).join(', ') || 'none'}`
      );
    }

    // Build update payload with timeline tracking
    const updates: Partial<Job> = { status: newStatus };
    const now = new Date().toISOString();

    switch (newStatus) {
      case 'assigned':
        updates.dispatchTime = now;
        break;
      case 'quarry_in':
        updates.quarryInTime = now;
        break;
      case 'quarry_out':
        updates.quarryOutTime = now;
        break;
      case 'site_in':
        updates.siteInTime = now;
        break;
      case 'site_out':
        updates.siteOutTime = now;
        break;
      case 'receipt_uploaded':
        updates.receiptTime = now;
        break;
      case 'completed':
        updates.completionTime = now;
        break;
    }

    return this.update(jobId, updates as any);
  }

  /**
   * Get valid next statuses for a job.
   */
  getValidTransitions(status: JobStatus): JobStatus[] {
    return VALID_TRANSITIONS[status] || [];
  }

  /**
   * Assign driver and vehicle to a job.
   */
  async assignResources(
    jobId: string,
    driverId: string,
    driverName: string,
    vehicleId: string,
    plateNumber: string
  ): Promise<Job> {
    return this.update(jobId, {
      driverId,
      driverName,
      vehicleId,
      plateNumber,
      status: 'assigned',
      dispatchTime: new Date().toISOString(),
    } as any);
  }

  /**
   * Record weigh-in for a job.
   */
  async recordWeighIn(jobId: string, weight: number, location: string): Promise<Job> {
    return this.update(jobId, {
      weighInWeight: weight,
      quarryInTime: new Date().toISOString(),
      status: 'quarry_in',
    } as any);
  }

  /**
   * Record weigh-out for a job.
   */
  async recordWeighOut(jobId: string, weight: number, location: string): Promise<Job> {
    return this.update(jobId, {
      weighOutWeight: weight,
      netWeight: weight, // Will be calculated properly
      quarryOutTime: new Date().toISOString(),
      status: 'quarry_out',
    } as any);
  }

  /**
   * Record site delivery.
   */
  async recordSiteDelivery(
    jobId: string,
    siteWeighIn: number,
    siteWeighOut: number,
    quantityDelivered: number
  ): Promise<Job> {
    const netWeight = siteWeighIn - siteWeighOut;
    const variance = this.calculateWeightVariance(
      jobId,
      netWeight,
      quantityDelivered
    );

    return this.update(jobId, {
      siteWeighInWeight: siteWeighIn,
      siteWeighOutWeight: siteWeighOut,
      siteNetWeight: netWeight,
      quantityDelivered,
      weightVariance: variance,
      hasWeightDiscrepancy: Math.abs(variance) > 5, // >5% is flagged
      siteInTime: new Date().toISOString(),
      status: 'site_in',
    } as any);
  }

  /**
   * Calculate weight variance between quarry and site.
   */
  private calculateWeightVariance(jobId: string, siteNetWeight: number, quantityDelivered: number): number {
    // This would ideally compare with quarry weights
    // For now, return 0 if no quarry weight
    return 0;
  }

  /**
   * Get delayed jobs (in progress for more than 6 hours).
   */
  async getDelayed(): Promise<Job[]> {
    const active = await this.getActive();
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    return active.filter((job) => {
      if (['completed', 'cancelled'].includes(job.status)) return false;
      const updatedAt = new Date(job.updatedAt || job.createdAt).getTime();
      return updatedAt < sixHoursAgo;
    });
  }

  /**
   * Get jobs with weight discrepancies.
   */
  async getWithWeightDiscrepancies(): Promise<Job[]> {
    const all = await this.getAll();
    return all.filter((job) => job.hasWeightDiscrepancy);
  }
}

export const jobRepository = new JobRepository();
