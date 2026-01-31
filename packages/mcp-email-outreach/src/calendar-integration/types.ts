import { z } from "zod";

import type { CalendarEvent, TimeSlot, MeetingConfig } from "@the-closer/mcp-calendar";

// ============================================
// Configuration
// ============================================

/**
 * Calendar integration configuration
 */
export const CalendarIntegrationConfigSchema = z.object({
  /** Default calendar ID */
  calendarId: z.string().default("primary"),
  /** Default meeting duration in minutes */
  defaultDurationMinutes: z.number().int().positive().default(30),
  /** Business hours start (0-23) */
  businessHoursStart: z.number().int().min(0).max(23).default(9),
  /** Business hours end (0-23) */
  businessHoursEnd: z.number().int().min(0).max(23).default(17),
  /** Working days (0=Sun, 6=Sat) */
  workingDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  /** Buffer between meetings in minutes */
  bufferMinutes: z.number().int().nonnegative().default(15),
  /** Booking link base URL */
  bookingBaseUrl: z.string().url().default("https://book.example.com"),
  /** Booking link expiration in days */
  bookingLinkExpirationDays: z.number().int().positive().default(7),
  /** Time zone */
  timezone: z.string().default("America/New_York"),
});

export type CalendarIntegrationConfig = z.output<typeof CalendarIntegrationConfigSchema>;

// ============================================
// Booking Types
// ============================================

/**
 * Availability slot for booking
 */
export interface AvailabilitySlot {
  start: Date;
  end: Date;
  durationMinutes: number;
  formatted: {
    date: string;
    startTime: string;
    endTime: string;
  };
}

/**
 * Booking request data
 */
export interface BookingRequest {
  leadId: string;
  slotStart: Date;
  slotEnd: Date;
  meetingTitle: string | undefined;
  meetingDescription: string | undefined;
  attendeeName: string | undefined;
  attendeeEmail: string;
}

/**
 * Booking result
 */
export interface BookingResult {
  success: boolean;
  event?: CalendarEvent;
  error?: string;
  confirmationSent: boolean;
}

/**
 * Booking link data
 */
export interface BookingLinkData {
  leadId: string;
  slots: Array<{ start: string; end: string }>;
  expiresAt: string;
  meetingConfig: MeetingConfig;
  signature: string;
}

/**
 * Cancellation result
 */
export interface CancellationResult {
  success: boolean;
  error?: string;
  leadStatusUpdated: boolean;
}

// ============================================
// Confirmation Types
// ============================================

/**
 * Confirmation email data
 */
export interface ConfirmationEmailData {
  leadId: string;
  leadEmail: string;
  leadName: string;
  eventId: string;
  eventTitle: string;
  eventStart: Date;
  eventEnd: Date;
  eventLink: string | undefined;
  meetLink: string | undefined;
}

/**
 * Team notification data
 */
export interface TeamNotificationData {
  leadId: string;
  leadName: string;
  leadBusinessName: string | undefined;
  leadEmail: string;
  eventTitle: string;
  eventStart: Date;
  eventEnd: Date;
  painPointsSummary: string | undefined;
  auditScore: number | undefined;
}

// ============================================
// Re-exports
// ============================================

export type { CalendarEvent, TimeSlot, MeetingConfig };
