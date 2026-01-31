import { z } from "zod";

// ============================================
// Configuration
// ============================================

/**
 * Google OAuth credentials
 */
export const GoogleOAuthCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().min(1),
  accessToken: z.string().optional(),
  tokenExpiry: z.date().optional(),
});

export type GoogleOAuthCredentials = z.output<typeof GoogleOAuthCredentialsSchema>;

/**
 * Calendar client configuration
 */
export const CalendarClientConfigSchema = z.object({
  credentials: GoogleOAuthCredentialsSchema,
  defaultCalendarId: z.string().default("primary"),
  timezone: z.string().default("America/New_York"),
  defaultMeetingDuration: z.number().int().positive().default(30), // minutes
  bufferBetweenMeetings: z.number().int().nonnegative().default(15), // minutes
  workingHoursStart: z.number().int().min(0).max(23).default(9),
  workingHoursEnd: z.number().int().min(0).max(23).default(17),
  workingDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]), // Mon-Fri
});

export type CalendarClientConfig = z.output<typeof CalendarClientConfigSchema>;

// ============================================
// Time Slots
// ============================================

/**
 * Available time slot
 */
export const TimeSlotSchema = z.object({
  start: z.date(),
  end: z.date(),
  available: z.boolean(),
  durationMinutes: z.number().int().positive(),
});

export type TimeSlot = z.output<typeof TimeSlotSchema>;

/**
 * Slot query options
 */
export const SlotQueryOptionsSchema = z.object({
  calendarId: z.string().default("primary"),
  startDate: z.date(),
  endDate: z.date(),
  durationMinutes: z.number().int().positive().default(30),
  respectWorkingHours: z.boolean().default(true),
  includeBuffer: z.boolean().default(true),
});

export type SlotQueryOptions = z.output<typeof SlotQueryOptionsSchema>;

// ============================================
// Events
// ============================================

/**
 * Reminder configuration
 */
export const ReminderConfigSchema = z.object({
  method: z.enum(["email", "popup"]),
  minutesBefore: z.number().int().nonnegative(),
});

export type ReminderConfig = z.output<typeof ReminderConfigSchema>;

/**
 * Event attendee
 */
export const AttendeeSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  responseStatus: z.enum(["needsAction", "declined", "tentative", "accepted"]).optional(),
  optional: z.boolean().optional(),
});

export type Attendee = z.output<typeof AttendeeSchema>;

/**
 * Event input for creating/updating events
 */
export const EventInputSchema = z.object({
  summary: z.string().min(1),
  description: z.string().optional(),
  start: z.date(),
  end: z.date(),
  location: z.string().optional(),
  attendees: z.array(z.union([z.string().email(), AttendeeSchema])).optional(),
  reminders: z.array(ReminderConfigSchema).optional(),
  conferenceData: z.object({
    createRequest: z.boolean().default(false),
    provider: z.enum(["googleMeet", "zoom"]).optional(),
  }).optional(),
  visibility: z.enum(["default", "public", "private"]).optional(),
  colorId: z.string().optional(),
});

export type EventInput = z.output<typeof EventInputSchema>;

/**
 * Calendar event (full event from API)
 */
export const CalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  start: z.date(),
  end: z.date(),
  location: z.string().optional(),
  attendees: z.array(AttendeeSchema).optional(),
  reminders: z.array(ReminderConfigSchema).optional(),
  htmlLink: z.string().url().optional(),
  hangoutLink: z.string().url().optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]),
  creator: z.object({
    email: z.string().email(),
    displayName: z.string().optional(),
  }).optional(),
  organizer: z.object({
    email: z.string().email(),
    displayName: z.string().optional(),
  }).optional(),
  created: z.date(),
  updated: z.date(),
  colorId: z.string().optional(),
  recurringEventId: z.string().optional(),
});

export type CalendarEvent = z.output<typeof CalendarEventSchema>;

// ============================================
// Meeting Configuration
// ============================================

/**
 * Meeting configuration for booking links
 */
export const MeetingConfigSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive().default(30),
  bufferMinutes: z.number().int().nonnegative().default(15),
  location: z.string().optional(),
  addConferenceLink: z.boolean().default(true),
  reminders: z.array(ReminderConfigSchema).default([
    { method: "email", minutesBefore: 1440 }, // 24 hours
    { method: "popup", minutesBefore: 30 },
  ]),
});

export type MeetingConfig = z.output<typeof MeetingConfigSchema>;

/**
 * Booking link data (encoded in URL)
 */
export const BookingLinkDataSchema = z.object({
  slots: z.array(z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  })),
  meetingConfig: MeetingConfigSchema,
  calendarId: z.string(),
  timezone: z.string(),
  expiresAt: z.string().datetime().optional(),
});

export type BookingLinkData = z.output<typeof BookingLinkDataSchema>;

// ============================================
// Error Codes
// ============================================

/**
 * Calendar-specific error codes
 */
export const CalendarErrorCode = {
  AUTH_FAILED: "CALENDAR_AUTH_FAILED",
  TOKEN_EXPIRED: "CALENDAR_TOKEN_EXPIRED",
  TOKEN_REFRESH_FAILED: "CALENDAR_TOKEN_REFRESH_FAILED",
  CALENDAR_NOT_FOUND: "CALENDAR_NOT_FOUND",
  EVENT_NOT_FOUND: "CALENDAR_EVENT_NOT_FOUND",
  CONFLICT: "CALENDAR_CONFLICT",
  RATE_LIMITED: "CALENDAR_RATE_LIMITED",
  API_ERROR: "CALENDAR_API_ERROR",
  INVALID_SLOT: "CALENDAR_INVALID_SLOT",
} as const;

export type CalendarErrorCodeType = (typeof CalendarErrorCode)[keyof typeof CalendarErrorCode];

// ============================================
// Utility Types
// ============================================

/**
 * Event list query options
 */
export const EventListOptionsSchema = z.object({
  calendarId: z.string().default("primary"),
  timeMin: z.date(),
  timeMax: z.date(),
  maxResults: z.number().int().positive().default(250),
  singleEvents: z.boolean().default(true),
  orderBy: z.enum(["startTime", "updated"]).default("startTime"),
});

export type EventListOptions = z.output<typeof EventListOptionsSchema>;

/**
 * Busy time from freebusy query
 */
export const BusyTimeSchema = z.object({
  start: z.date(),
  end: z.date(),
});

export type BusyTime = z.output<typeof BusyTimeSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Parse ISO datetime string to Date
 */
export function parseDateTime(value: string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

/**
 * Format Date to ISO string
 */
export function formatDateTime(date: Date): string {
  return date.toISOString();
}

/**
 * Check if a date is within working hours
 */
export function isWithinWorkingHours(
  date: Date,
  workingHoursStart: number,
  workingHoursEnd: number,
  workingDays: number[]
): boolean {
  const day = date.getDay();
  const hour = date.getHours();

  return workingDays.includes(day) && hour >= workingHoursStart && hour < workingHoursEnd;
}

/**
 * Get the next working day start time
 */
export function getNextWorkingDayStart(
  fromDate: Date,
  workingHoursStart: number,
  workingDays: number[]
): Date {
  const result = new Date(fromDate);
  result.setHours(workingHoursStart, 0, 0, 0);

  // If current time is after working hours start, move to next day
  if (fromDate.getHours() >= workingHoursStart) {
    result.setDate(result.getDate() + 1);
  }

  // Find next working day
  let attempts = 0;
  while (!workingDays.includes(result.getDay()) && attempts < 7) {
    result.setDate(result.getDate() + 1);
    attempts++;
  }

  return result;
}

/**
 * Calculate duration between two dates in minutes
 */
export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
