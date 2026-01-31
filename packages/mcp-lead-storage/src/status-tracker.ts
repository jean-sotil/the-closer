import { randomUUID } from "node:crypto";

import {
  type LeadProfile,
  type ContactStatus,
  ValidationError,
  NotFoundError,
} from "@the-closer/shared";

import { LeadRepository } from "./lead-repository.js";
import { SupabaseClient } from "./supabase/client.js";
import { mapSupabaseError } from "./supabase/errors.js";

/**
 * Valid status transitions (state machine)
 *
 * pending -> emailed, called, declined
 * emailed -> called, booked, converted, declined
 * called -> booked, converted, declined
 * booked -> converted, declined
 * converted -> (terminal)
 * declined -> (terminal)
 */
const VALID_TRANSITIONS: Record<ContactStatus, ContactStatus[]> = {
  pending: ["emailed", "called", "declined"],
  emailed: ["called", "booked", "converted", "declined"],
  called: ["booked", "converted", "declined"],
  booked: ["converted", "declined"],
  converted: [], // Terminal state
  declined: [], // Terminal state
};

/**
 * Status history entry
 */
export interface StatusHistoryEntry {
  id: string;
  leadId: string;
  fromStatus: ContactStatus;
  toStatus: ContactStatus;
  reason: string | null;
  changedAt: string;
  changedBy: string | null;
}

/**
 * Webhook callback type
 */
export type StatusWebhookCallback = (
  lead: LeadProfile,
  fromStatus: ContactStatus,
  toStatus: ContactStatus
) => Promise<void>;

/**
 * Status update options
 */
export interface StatusUpdateOptions {
  notes?: string;
  reason?: string;
  changedBy?: string;
  skipWebhooks?: boolean;
}

/**
 * Bulk update result
 */
export interface BulkStatusUpdateResult {
  successful: Array<{ id: string; lead: LeadProfile }>;
  failed: Array<{ id: string; error: string }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  fromStatus: ContactStatus,
  toStatus: ContactStatus
): boolean {
  const allowedTransitions = VALID_TRANSITIONS[fromStatus];
  return allowedTransitions.includes(toStatus);
}

/**
 * Get allowed transitions from a status
 */
export function getAllowedTransitions(status: ContactStatus): ContactStatus[] {
  return [...VALID_TRANSITIONS[status]];
}

/**
 * Check if a status is terminal (no outgoing transitions)
 */
export function isTerminalStatus(status: ContactStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * StatusTracker - Manages lead status transitions with validation and history
 *
 * Enforces valid state transitions, logs history, and triggers webhooks
 * on status changes.
 */
export class StatusTracker {
  private readonly repository: LeadRepository;
  private readonly client: SupabaseClient;
  private readonly historyTableName = "status_history";
  private readonly webhookCallbacks: Map<ContactStatus, StatusWebhookCallback[]>;

  constructor(repository: LeadRepository, client: SupabaseClient) {
    this.repository = repository;
    this.client = client;
    this.webhookCallbacks = new Map();

    // Initialize callback arrays for all statuses
    const statuses: ContactStatus[] = [
      "pending",
      "emailed",
      "called",
      "booked",
      "converted",
      "declined",
    ];
    for (const status of statuses) {
      this.webhookCallbacks.set(status, []);
    }
  }

  /**
   * Update lead status with validation
   */
  async updateLeadStatus(
    id: string,
    newStatus: ContactStatus,
    options: StatusUpdateOptions = {}
  ): Promise<LeadProfile> {
    // Get current lead
    const lead = await this.repository.getLeadById(id);
    if (!lead) {
      throw new NotFoundError(`Lead not found: ${id}`);
    }

    const currentStatus = lead.contactStatus;

    // Validate transition
    if (!isValidTransition(currentStatus, newStatus)) {
      throw new ValidationError(
        `Invalid status transition: ${currentStatus} -> ${newStatus}`,
        {
          context: {
            currentStatus,
            newStatus,
            allowedTransitions: getAllowedTransitions(currentStatus),
          },
        }
      );
    }

    // Update lead status
    const updateData: Partial<LeadProfile> = {
      contactStatus: newStatus,
    };
    if (options.notes !== undefined) {
      updateData.notes = options.notes;
    }
    // Update last contacted timestamp for outreach statuses
    if (["emailed", "called"].includes(newStatus)) {
      updateData.lastContactedAt = new Date().toISOString();
    }

    const updatedLead = await this.repository.updateLead(id, updateData);

    // Log history
    await this.logStatusChange(id, currentStatus, newStatus, options);

    // Trigger webhooks (unless skipped)
    if (!options.skipWebhooks) {
      await this.triggerWebhooks(updatedLead, currentStatus, newStatus);
    }

    return updatedLead;
  }

  /**
   * Log a status change to history
   */
  private async logStatusChange(
    leadId: string,
    fromStatus: ContactStatus,
    toStatus: ContactStatus,
    options: StatusUpdateOptions
  ): Promise<void> {
    const entry: Record<string, unknown> = {
      id: randomUUID(),
      lead_id: leadId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_at: new Date().toISOString(),
    };

    if (options.reason !== undefined) {
      entry["reason"] = options.reason;
    }
    if (options.changedBy !== undefined) {
      entry["changed_by"] = options.changedBy;
    }

    try {
      await this.client.insert<Record<string, unknown>>(
        this.historyTableName,
        entry
      );
    } catch (error) {
      // Log error but don't fail the status update
      console.error("Failed to log status history:", error);
    }
  }

  /**
   * Get status history for a lead
   */
  async getStatusHistory(leadId: string): Promise<StatusHistoryEntry[]> {
    try {
      const result = await this.client.select<Record<string, unknown>>(
        this.historyTableName,
        {
          filters: [{ column: "lead_id", operator: "eq", value: leadId }],
          ordering: [{ column: "changed_at", ascending: false }],
        }
      );

      return result.data.map((row) => ({
        id: row["id"] as string,
        leadId: row["lead_id"] as string,
        fromStatus: row["from_status"] as ContactStatus,
        toStatus: row["to_status"] as ContactStatus,
        reason: row["reason"] as string | null,
        changedAt: row["changed_at"] as string,
        changedBy: row["changed_by"] as string | null,
      }));
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Register a webhook callback for a specific target status
   */
  onStatusChange(
    targetStatus: ContactStatus,
    callback: StatusWebhookCallback
  ): () => void {
    const callbacks = this.webhookCallbacks.get(targetStatus) ?? [];
    callbacks.push(callback);
    this.webhookCallbacks.set(targetStatus, callbacks);

    // Return unsubscribe function
    return () => {
      const currentCallbacks = this.webhookCallbacks.get(targetStatus) ?? [];
      const index = currentCallbacks.indexOf(callback);
      if (index >= 0) {
        currentCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register a webhook for any status change
   */
  onAnyStatusChange(callback: StatusWebhookCallback): () => void {
    const unsubscribers: Array<() => void> = [];

    const statuses: ContactStatus[] = [
      "pending",
      "emailed",
      "called",
      "booked",
      "converted",
      "declined",
    ];

    for (const status of statuses) {
      unsubscribers.push(this.onStatusChange(status, callback));
    }

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }

  /**
   * Trigger webhooks for a status change
   */
  private async triggerWebhooks(
    lead: LeadProfile,
    fromStatus: ContactStatus,
    toStatus: ContactStatus
  ): Promise<void> {
    const callbacks = this.webhookCallbacks.get(toStatus) ?? [];

    for (const callback of callbacks) {
      try {
        await callback(lead, fromStatus, toStatus);
      } catch (error) {
        // Log but don't fail the operation
        console.error(`Webhook error for status ${toStatus}:`, error);
      }
    }
  }

  /**
   * Update status for multiple leads in batch
   */
  async updateStatusBatch(
    leadIds: string[],
    newStatus: ContactStatus,
    options: StatusUpdateOptions = {}
  ): Promise<BulkStatusUpdateResult> {
    const successful: Array<{ id: string; lead: LeadProfile }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of leadIds) {
      try {
        const lead = await this.updateLeadStatus(id, newStatus, options);
        successful.push({ id, lead });
      } catch (error) {
        failed.push({
          id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      successful,
      failed,
      totalProcessed: leadIds.length,
      successCount: successful.length,
      failureCount: failed.length,
    };
  }

  /**
   * Get transition statistics
   */
  async getTransitionStats(
    startDate?: string,
    endDate?: string
  ): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};

    try {
      const filters = [];
      if (startDate) {
        filters.push({
          column: "changed_at",
          operator: "gte" as const,
          value: startDate,
        });
      }
      if (endDate) {
        filters.push({
          column: "changed_at",
          operator: "lte" as const,
          value: endDate,
        });
      }

      const result = await this.client.select<Record<string, unknown>>(
        this.historyTableName,
        { filters }
      );

      for (const row of result.data) {
        const fromStatus = row["from_status"] as string;
        const toStatus = row["to_status"] as string;
        const key = `${fromStatus} -> ${toStatus}`;
        stats[key] = (stats[key] ?? 0) + 1;
      }
    } catch (error) {
      console.error("Failed to get transition stats:", error);
    }

    return stats;
  }

  /**
   * Get leads that have been in a status for too long
   */
  async getStaleLeads(
    status: ContactStatus,
    olderThanDays: number
  ): Promise<LeadProfile[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.repository.searchLeads(
      {
        status,
        discoveredBefore: cutoff.toISOString(),
      },
      { limit: 1000 }
    );

    return result.items;
  }

  /**
   * Validate a proposed status change without applying it
   */
  validateTransition(
    currentStatus: ContactStatus,
    proposedStatus: ContactStatus
  ): {
    valid: boolean;
    reason?: string;
    allowedTransitions: ContactStatus[];
  } {
    const allowed = getAllowedTransitions(currentStatus);

    if (isValidTransition(currentStatus, proposedStatus)) {
      return { valid: true, allowedTransitions: allowed };
    }

    if (isTerminalStatus(currentStatus)) {
      return {
        valid: false,
        reason: `${currentStatus} is a terminal status with no outgoing transitions`,
        allowedTransitions: [],
      };
    }

    return {
      valid: false,
      reason: `Cannot transition from ${currentStatus} to ${proposedStatus}`,
      allowedTransitions: allowed,
    };
  }

  /**
   * Get funnel metrics
   */
  async getFunnelMetrics(): Promise<{
    pending: number;
    emailed: number;
    called: number;
    booked: number;
    converted: number;
    declined: number;
    conversionRate: number;
  }> {
    const stats = await this.repository.countByStatus();

    const totalContacted =
      stats.emailed + stats.called + stats.booked + stats.converted;
    const conversionRate =
      totalContacted > 0 ? (stats.converted / totalContacted) * 100 : 0;

    return {
      ...stats,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  }
}
