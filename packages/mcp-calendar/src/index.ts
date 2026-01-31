/**
 * MCP Calendar Client
 *
 * Type-safe wrapper for Google Calendar operations including
 * availability checking, event management, and booking links.
 */

// Main client class
export { CalendarClient } from "./calendar-client.js";

// Error handling
export { CalendarError, mapCalendarApiError, isCalendarError, isRetryableCalendarError } from "./errors.js";

// Types and schemas
export type {
  GoogleOAuthCredentials,
  CalendarClientConfig,
  TimeSlot,
  SlotQueryOptions,
  ReminderConfig,
  Attendee,
  EventInput,
  CalendarEvent,
  MeetingConfig,
  BookingLinkData,
  CalendarErrorCodeType,
  EventListOptions,
  BusyTime,
} from "./types.js";

export {
  GoogleOAuthCredentialsSchema,
  CalendarClientConfigSchema,
  TimeSlotSchema,
  SlotQueryOptionsSchema,
  ReminderConfigSchema,
  AttendeeSchema,
  EventInputSchema,
  CalendarEventSchema,
  MeetingConfigSchema,
  BookingLinkDataSchema,
  CalendarErrorCode,
  EventListOptionsSchema,
  BusyTimeSchema,
  parseDateTime,
  formatDateTime,
  isWithinWorkingHours,
  getNextWorkingDayStart,
  getDurationMinutes,
  addMinutes,
} from "./types.js";
