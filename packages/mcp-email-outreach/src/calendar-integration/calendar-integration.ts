import { createHmac, randomBytes } from "node:crypto";

import { type LeadProfile, AppError, ErrorCode } from "@the-closer/shared";
import { CalendarClient, type TimeSlot, CalendarError } from "@the-closer/mcp-calendar";
import type { LeadRepository } from "@the-closer/mcp-lead-storage";

import {
  type CalendarIntegrationConfig,
  type AvailabilitySlot,
  type BookingRequest,
  type BookingResult,
  type BookingLinkData,
  type CancellationResult,
  type ConfirmationEmailData,
  type TeamNotificationData,
  CalendarIntegrationConfigSchema,
} from "./types.js";

// ============================================
// Calendar Integration
// ============================================

/**
 * CalendarIntegration - Meeting scheduling with availability checking
 *
 * Provides availability lookup, booking link generation, meeting booking,
 * and confirmation/cancellation workflows integrated with lead management.
 */
export class CalendarIntegration {
  private readonly calendarClient: CalendarClient;
  private readonly leadRepository: LeadRepository;
  private readonly config: CalendarIntegrationConfig;
  private readonly signingSecret: string;

  /**
   * Callback for sending confirmation emails
   */
  public onSendConfirmation?: (data: ConfirmationEmailData) => Promise<void>;

  /**
   * Callback for sending team notifications
   */
  public onNotifyTeam?: (data: TeamNotificationData) => Promise<void>;

  constructor(
    calendarClient: CalendarClient,
    leadRepository: LeadRepository,
    config: Partial<CalendarIntegrationConfig> = {},
    signingSecret?: string
  ) {
    this.calendarClient = calendarClient;
    this.leadRepository = leadRepository;
    this.config = CalendarIntegrationConfigSchema.parse(config);
    this.signingSecret = signingSecret ?? randomBytes(32).toString("hex");
  }

  // ============================================
  // Availability
  // ============================================

  /**
   * Get available time slots for the next N days
   *
   * @param days - Number of days to look ahead
   * @param durationMinutes - Meeting duration (default from config)
   * @returns Array of available slots with formatted times
   */
  async getAvailability(
    days: number = 7,
    durationMinutes?: number
  ): Promise<AvailabilitySlot[]> {
    const duration = durationMinutes ?? this.config.defaultDurationMinutes;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const slots = await this.calendarClient.getAvailableSlots({
      calendarId: this.config.calendarId,
      startDate,
      endDate,
      durationMinutes: duration,
      respectWorkingHours: true,
      includeBuffer: true,
    });

    // Filter to only available slots and format
    return slots
      .filter((slot) => slot.available)
      .map((slot) => this.formatSlot(slot));
  }

  /**
   * Check if a specific time slot is available
   *
   * @param start - Slot start time
   * @param end - Slot end time
   * @returns True if slot is available
   */
  async isSlotAvailable(start: Date, end: Date): Promise<boolean> {
    const hasConflict = await this.calendarClient.checkConflicts(
      this.config.calendarId,
      start,
      end
    );
    return !hasConflict;
  }

  // ============================================
  // Booking Link Generation
  // ============================================

  /**
   * Generate a signed booking link for a lead
   *
   * @param leadId - Lead UUID
   * @param slots - Available slots to include in link
   * @param meetingTitle - Optional meeting title
   * @returns Signed booking URL
   */
  generateBookingLink(
    leadId: string,
    slots: AvailabilitySlot[],
    meetingTitle?: string
  ): string {
    if (slots.length === 0) {
      throw new AppError("No slots available for booking link", {
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
        context: { leadId },
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.bookingLinkExpirationDays);

    const data: BookingLinkData = {
      leadId,
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
      expiresAt: expiresAt.toISOString(),
      meetingConfig: {
        title: meetingTitle ?? "Discovery Call",
        durationMinutes: this.config.defaultDurationMinutes,
        bufferMinutes: this.config.bufferMinutes,
        addConferenceLink: true,
        reminders: [
          { method: "email", minutesBefore: 1440 }, // 24 hours
          { method: "popup", minutesBefore: 30 },
        ],
      },
      signature: "", // Will be set below
    };

    // Generate signature
    data.signature = this.signBookingData(data);

    // Encode and create URL
    const encodedData = Buffer.from(JSON.stringify(data)).toString("base64url");
    return `${this.config.bookingBaseUrl}/book?data=${encodedData}`;
  }

  /**
   * Parse and validate a booking link
   *
   * @param url - Booking URL to parse
   * @returns Parsed booking data or null if invalid/expired
   */
  parseBookingLink(url: string): BookingLinkData | null {
    try {
      const urlObj = new URL(url);
      const encodedData = urlObj.searchParams.get("data");

      if (!encodedData) {
        return null;
      }

      const jsonData = Buffer.from(encodedData, "base64url").toString("utf-8");
      const data = JSON.parse(jsonData) as BookingLinkData;

      // Verify signature
      const expectedSignature = this.signBookingData({ ...data, signature: "" });
      if (data.signature !== expectedSignature) {
        return null;
      }

      // Check expiration
      if (new Date(data.expiresAt) < new Date()) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  // ============================================
  // Booking Execution
  // ============================================

  /**
   * Book a meeting for a lead
   *
   * @param request - Booking request details
   * @returns Booking result with event details
   */
  async bookMeeting(request: BookingRequest): Promise<BookingResult> {
    // Get lead details
    const lead = await this.leadRepository.getLeadById(request.leadId);
    if (!lead) {
      return {
        success: false,
        error: `Lead not found: ${request.leadId}`,
        confirmationSent: false,
      };
    }

    // Verify slot is still available
    const isAvailable = await this.isSlotAvailable(request.slotStart, request.slotEnd);
    if (!isAvailable) {
      return {
        success: false,
        error: "Selected time slot is no longer available",
        confirmationSent: false,
      };
    }

    // Build meeting description with lead context
    const description = this.buildMeetingDescription(lead, request.meetingDescription);

    try {
      // Create calendar event
      const event = await this.calendarClient.createEvent(this.config.calendarId, {
        summary: request.meetingTitle ?? `Discovery Call: ${lead.businessName}`,
        description,
        start: request.slotStart,
        end: request.slotEnd,
        attendees: [
          {
            email: request.attendeeEmail,
            displayName: request.attendeeName ?? lead.businessName,
          },
        ],
        reminders: [
          { method: "email", minutesBefore: 1440 },
          { method: "popup", minutesBefore: 30 },
        ],
        conferenceData: {
          createRequest: true,
          provider: "googleMeet",
        },
      });

      // Update lead status to booked
      await this.leadRepository.updateLead(request.leadId, {
        contactStatus: "booked",
        notes: `Meeting booked: ${event.id} at ${request.slotStart.toISOString()}`,
      });

      // Send confirmation (if callback is set)
      let confirmationSent = false;
      if (this.onSendConfirmation) {
        try {
          await this.onSendConfirmation({
            leadId: request.leadId,
            leadEmail: request.attendeeEmail,
            leadName: request.attendeeName ?? lead.businessName,
            eventId: event.id,
            eventTitle: event.summary,
            eventStart: event.start,
            eventEnd: event.end,
            eventLink: event.htmlLink,
            meetLink: event.hangoutLink,
          });
          confirmationSent = true;
        } catch {
          // Log but don't fail the booking
        }
      }

      // Notify team (if callback is set)
      if (this.onNotifyTeam) {
        try {
          await this.onNotifyTeam({
            leadId: request.leadId,
            leadName: request.attendeeName ?? lead.businessName,
            leadBusinessName: lead.businessName,
            leadEmail: request.attendeeEmail,
            eventTitle: event.summary,
            eventStart: event.start,
            eventEnd: event.end,
            painPointsSummary: this.summarizePainPoints(lead),
            auditScore: lead.performanceScore ?? undefined,
          });
        } catch {
          // Log but don't fail the booking
        }
      }

      return {
        success: true,
        event,
        confirmationSent,
      };
    } catch (error) {
      const message = error instanceof CalendarError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to create calendar event";

      return {
        success: false,
        error: message,
        confirmationSent: false,
      };
    }
  }

  // ============================================
  // Cancellation
  // ============================================

  /**
   * Cancel a booked meeting
   *
   * @param leadId - Lead UUID
   * @param eventId - Calendar event ID
   * @returns Cancellation result
   */
  async cancelMeeting(leadId: string, eventId: string): Promise<CancellationResult> {
    // Verify lead exists
    const lead = await this.leadRepository.getLeadById(leadId);
    if (!lead) {
      return {
        success: false,
        error: `Lead not found: ${leadId}`,
        leadStatusUpdated: false,
      };
    }

    try {
      // Delete calendar event
      await this.calendarClient.deleteEvent(this.config.calendarId, eventId);

      // Update lead status back to called (previous state)
      await this.leadRepository.updateLead(leadId, {
        contactStatus: "called",
        notes: `Meeting cancelled: ${eventId} at ${new Date().toISOString()}`,
      });

      return {
        success: true,
        leadStatusUpdated: true,
      };
    } catch (error) {
      const message = error instanceof CalendarError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to cancel meeting";

      return {
        success: false,
        error: message,
        leadStatusUpdated: false,
      };
    }
  }

  // ============================================
  // Quick Booking
  // ============================================

  /**
   * Quick book a meeting with automatic slot selection
   *
   * Finds the next available slot and books it for the lead.
   *
   * @param leadId - Lead UUID
   * @param attendeeEmail - Attendee email address
   * @param attendeeName - Optional attendee name
   * @param preferredDays - Number of days to search
   * @returns Booking result
   */
  async quickBook(
    leadId: string,
    attendeeEmail: string,
    attendeeName?: string,
    preferredDays: number = 7
  ): Promise<BookingResult> {
    // Get available slots
    const slots = await this.getAvailability(preferredDays);

    if (slots.length === 0) {
      return {
        success: false,
        error: `No available slots in the next ${preferredDays} days`,
        confirmationSent: false,
      };
    }

    // Book the first available slot
    const slot = slots[0];
    if (!slot) {
      return {
        success: false,
        error: "No valid slots found",
        confirmationSent: false,
      };
    }

    return this.bookMeeting({
      leadId,
      slotStart: slot.start,
      slotEnd: slot.end,
      attendeeEmail,
      attendeeName,
      meetingTitle: undefined,
      meetingDescription: undefined,
    });
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Format a time slot with human-readable times
   */
  private formatSlot(slot: TimeSlot): AvailabilitySlot {
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: this.config.timezone,
    };

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: this.config.timezone,
    };

    return {
      start: slot.start,
      end: slot.end,
      durationMinutes: slot.durationMinutes,
      formatted: {
        date: slot.start.toLocaleDateString("en-US", dateOptions),
        startTime: slot.start.toLocaleTimeString("en-US", timeOptions),
        endTime: slot.end.toLocaleTimeString("en-US", timeOptions),
      },
    };
  }

  /**
   * Build meeting description with lead context
   */
  private buildMeetingDescription(lead: LeadProfile, customDescription?: string): string {
    const parts: string[] = [];

    if (customDescription) {
      parts.push(customDescription);
      parts.push("");
    }

    parts.push("--- Lead Information ---");
    parts.push(`Business: ${lead.businessName}`);

    if (lead.websiteUrl) {
      parts.push(`Website: ${lead.websiteUrl}`);
    }

    if (lead.phoneNumber) {
      parts.push(`Phone: ${lead.phoneNumber}`);
    }

    if (lead.performanceScore !== undefined) {
      parts.push(`Performance Score: ${lead.performanceScore}/100`);
    }

    if (lead.accessibilityScore !== undefined) {
      parts.push(`Accessibility Score: ${lead.accessibilityScore}/100`);
    }

    const painPoints = this.summarizePainPoints(lead);
    if (painPoints) {
      parts.push("");
      parts.push("--- Key Issues ---");
      parts.push(painPoints);
    }

    return parts.join("\n");
  }

  /**
   * Summarize lead pain points for notifications
   */
  private summarizePainPoints(lead: LeadProfile): string | undefined {
    if (!lead.painPoints || lead.painPoints.length === 0) {
      return undefined;
    }

    return lead.painPoints
      .slice(0, 3) // Top 3
      .map((pp) => `• ${pp.type}: ${pp.value}`)
      .join("\n");
  }

  /**
   * Sign booking data with HMAC
   */
  private signBookingData(data: BookingLinkData): string {
    const payload = JSON.stringify({
      leadId: data.leadId,
      slots: data.slots,
      expiresAt: data.expiresAt,
    });

    return createHmac("sha256", this.signingSecret)
      .update(payload)
      .digest("hex");
  }
}
