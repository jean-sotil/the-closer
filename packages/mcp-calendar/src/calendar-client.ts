import { ValidationError } from "@the-closer/shared";
import { CalendarError, mapCalendarApiError } from "./errors.js";
import {
  type CalendarClientConfig,
  type TimeSlot,
  type SlotQueryOptions,
  type EventInput,
  type CalendarEvent,
  type EventListOptions,
  type BusyTime,
  type MeetingConfig,
  type BookingLinkData,
  type Attendee,
  CalendarClientConfigSchema,
  SlotQueryOptionsSchema,
  EventInputSchema,
  CalendarErrorCode,
  isWithinWorkingHours,
  getNextWorkingDayStart,
  addMinutes,
} from "./types.js";

/**
 * Google Calendar MCP Client
 *
 * Type-safe wrapper for Google Calendar operations including
 * availability checking, event management, and booking links.
 */
export class CalendarClient {
  private readonly config: CalendarClientConfig;
  private connected = false;

  // In-memory event cache for availability calculations
  private eventCache = new Map<string, { events: CalendarEvent[]; fetchedAt: Date }>();
  private readonly cacheTtlMs = 60000; // 1 minute cache

  constructor(config: CalendarClientConfig) {
    const parseResult = CalendarClientConfigSchema.safeParse(config);
    if (!parseResult.success) {
      throw new ValidationError("Invalid calendar client configuration", {
        context: { errors: parseResult.error.errors },
      });
    }
    this.config = parseResult.data;
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Connect to Google Calendar and validate credentials
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // In a real implementation, this would:
      // 1. Validate the refresh token
      // 2. Get a new access token if needed
      // 3. Test API access by fetching calendar list

      // Validate that we have required credentials
      if (!this.config.credentials.refreshToken) {
        throw new CalendarError("Missing refresh token", {
          calendarCode: CalendarErrorCode.AUTH_FAILED,
          statusCode: 401,
        });
      }

      // Simulate token validation
      // In production, this would call Google OAuth token endpoint
      this.connected = true;
    } catch (error) {
      throw mapCalendarApiError(error);
    }
  }

  /**
   * Disconnect from Google Calendar
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.eventCache.clear();
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Ensure client is connected before operations
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new CalendarError("Calendar client not connected. Call connect() first.", {
        calendarCode: CalendarErrorCode.AUTH_FAILED,
        statusCode: 401,
      });
    }
  }

  // ============================================
  // Availability Operations
  // ============================================

  /**
   * Get available time slots within a date range
   */
  async getAvailableSlots(options: SlotQueryOptions): Promise<TimeSlot[]> {
    this.ensureConnected();

    const parseResult = SlotQueryOptionsSchema.safeParse(options);
    if (!parseResult.success) {
      throw new ValidationError("Invalid slot query options", {
        context: { errors: parseResult.error.errors },
      });
    }

    const { calendarId, startDate, endDate, durationMinutes, respectWorkingHours, includeBuffer } =
      parseResult.data;

    // Get existing events
    const events = await this.listEvents({
      calendarId,
      timeMin: startDate,
      timeMax: endDate,
    });

    // Build busy times from events
    const busyTimes: BusyTime[] = events.map((event) => ({
      start: event.start,
      end: event.end,
    }));

    // Calculate available slots
    const slots: TimeSlot[] = [];
    let currentTime = new Date(startDate);

    // If start time is before working hours, move to start of working hours
    if (respectWorkingHours && currentTime.getHours() < this.config.workingHoursStart) {
      currentTime.setHours(this.config.workingHoursStart, 0, 0, 0);
    }

    while (currentTime < endDate) {
      // Check working hours
      if (
        respectWorkingHours &&
        !isWithinWorkingHours(
          currentTime,
          this.config.workingHoursStart,
          this.config.workingHoursEnd,
          this.config.workingDays
        )
      ) {
        // Move to next working day
        currentTime = getNextWorkingDayStart(
          currentTime,
          this.config.workingHoursStart,
          this.config.workingDays
        );
        continue;
      }

      const slotEnd = addMinutes(currentTime, durationMinutes);

      // Check if slot end is still within working hours
      if (
        respectWorkingHours &&
        slotEnd.getHours() >= this.config.workingHoursEnd
      ) {
        // Move to next working day
        currentTime = getNextWorkingDayStart(
          currentTime,
          this.config.workingHoursStart,
          this.config.workingDays
        );
        continue;
      }

      // Check for conflicts with existing events
      const hasConflict = this.hasTimeConflict(currentTime, slotEnd, busyTimes, includeBuffer);

      if (!hasConflict) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(slotEnd),
          available: true,
          durationMinutes,
        });
      }

      // Move to next potential slot (add duration + buffer)
      const increment = includeBuffer
        ? durationMinutes + this.config.bufferBetweenMeetings
        : durationMinutes;
      currentTime = addMinutes(currentTime, increment);
    }

    return slots;
  }

  /**
   * Check if a time range conflicts with any existing events
   */
  async checkConflicts(
    calendarId: string,
    start: Date,
    end: Date
  ): Promise<boolean> {
    this.ensureConnected();

    const events = await this.listEvents({
      calendarId,
      timeMin: start,
      timeMax: end,
    });

    const busyTimes = events.map((e) => ({ start: e.start, end: e.end }));
    return this.hasTimeConflict(start, end, busyTimes, false);
  }

  /**
   * Check if a time slot conflicts with busy times
   */
  private hasTimeConflict(
    start: Date,
    end: Date,
    busyTimes: BusyTime[],
    includeBuffer: boolean
  ): boolean {
    const bufferMs = includeBuffer ? this.config.bufferBetweenMeetings * 60 * 1000 : 0;
    const adjustedStart = new Date(start.getTime() - bufferMs);
    const adjustedEnd = new Date(end.getTime() + bufferMs);

    return busyTimes.some((busy) => {
      return adjustedStart < busy.end && adjustedEnd > busy.start;
    });
  }

  // ============================================
  // Event Operations
  // ============================================

  /**
   * List events within a time range
   */
  async listEvents(options: Partial<EventListOptions>): Promise<CalendarEvent[]> {
    this.ensureConnected();

    const calendarId = options.calendarId ?? this.config.defaultCalendarId;
    const cacheKey = `${calendarId}:${options.timeMin?.toISOString()}:${options.timeMax?.toISOString()}`;

    // Check cache
    const cached = this.eventCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt.getTime() < this.cacheTtlMs) {
      return cached.events;
    }

    // In production, this would call the Google Calendar API via MCP
    // For now, return empty array as placeholder
    const events: CalendarEvent[] = [];

    // Update cache
    this.eventCache.set(cacheKey, { events, fetchedAt: new Date() });

    return events;
  }

  /**
   * Create a new calendar event
   */
  async createEvent(
    calendarId: string,
    event: EventInput
  ): Promise<CalendarEvent> {
    this.ensureConnected();

    const parseResult = EventInputSchema.safeParse(event);
    if (!parseResult.success) {
      throw new ValidationError("Invalid event input", {
        context: { errors: parseResult.error.errors },
      });
    }

    const validatedEvent = parseResult.data;

    // Check for conflicts
    const hasConflict = await this.checkConflicts(
      calendarId,
      validatedEvent.start,
      validatedEvent.end
    );

    if (hasConflict) {
      throw new CalendarError("Time slot conflicts with existing event", {
        calendarCode: CalendarErrorCode.CONFLICT,
        statusCode: 409,
        context: {
          start: validatedEvent.start.toISOString(),
          end: validatedEvent.end.toISOString(),
        },
      });
    }

    // In production, this would call the Google Calendar API via MCP
    // For now, create a mock response
    const now = new Date();
    const createdEvent: CalendarEvent = {
      id: `event_${Date.now()}`,
      summary: validatedEvent.summary,
      description: validatedEvent.description,
      start: validatedEvent.start,
      end: validatedEvent.end,
      location: validatedEvent.location,
      status: "confirmed",
      created: now,
      updated: now,
      htmlLink: `https://calendar.google.com/calendar/event?eid=${Date.now()}`,
    };

    // Invalidate cache
    this.invalidateCache(calendarId);

    return createdEvent;
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    updates: Partial<EventInput>
  ): Promise<CalendarEvent> {
    this.ensureConnected();

    // Get existing event first
    const existing = await this.getEvent(calendarId, eventId);

    // Transform attendees from EventInput format to CalendarEvent format
    const transformedAttendees: Attendee[] | undefined = updates.attendees
      ? updates.attendees.map((a): Attendee =>
          typeof a === "string" ? { email: a } : a
        )
      : undefined;

    // Apply updates (excluding attendees which we handle separately)
    const { attendees: _attendeesInput, ...otherUpdates } = updates;
    const updated: CalendarEvent = {
      ...existing,
      ...otherUpdates,
      ...(transformedAttendees !== undefined && { attendees: transformedAttendees }),
      updated: new Date(),
    };

    // If time changed, check for conflicts
    if (updates.start || updates.end) {
      const hasConflict = await this.checkConflicts(
        calendarId,
        updated.start,
        updated.end
      );

      if (hasConflict) {
        throw new CalendarError("Updated time conflicts with existing event", {
          calendarCode: CalendarErrorCode.CONFLICT,
          statusCode: 409,
        });
      }
    }

    // Invalidate cache
    this.invalidateCache(calendarId);

    return updated;
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    this.ensureConnected();

    // Verify event exists
    await this.getEvent(calendarId, eventId);

    // In production, this would call the Google Calendar API via MCP

    // Invalidate cache
    this.invalidateCache(calendarId);
  }

  /**
   * Get a single calendar event
   */
  async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
    this.ensureConnected();

    // In production, this would call the Google Calendar API via MCP
    // For now, throw not found as placeholder
    throw new CalendarError(`Event not found: ${eventId}`, {
      calendarCode: CalendarErrorCode.EVENT_NOT_FOUND,
      statusCode: 404,
      context: { calendarId, eventId },
    });
  }

  /**
   * Invalidate event cache for a calendar
   */
  private invalidateCache(calendarId: string): void {
    for (const key of this.eventCache.keys()) {
      if (key.startsWith(`${calendarId}:`)) {
        this.eventCache.delete(key);
      }
    }
  }

  // ============================================
  // Booking Link Generation
  // ============================================

  /**
   * Generate a booking link from available slots
   */
  generateBookingLink(
    slots: TimeSlot[],
    meetingConfig: MeetingConfig,
    baseUrl: string = "https://book.example.com"
  ): string {
    if (slots.length === 0) {
      throw new CalendarError("No slots available for booking link", {
        calendarCode: CalendarErrorCode.INVALID_SLOT,
        statusCode: 400,
      });
    }

    // Filter to only available slots
    const availableSlots = slots.filter((s) => s.available);

    if (availableSlots.length === 0) {
      throw new CalendarError("No available slots for booking link", {
        calendarCode: CalendarErrorCode.INVALID_SLOT,
        statusCode: 400,
      });
    }

    const bookingData: BookingLinkData = {
      slots: availableSlots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
      meetingConfig,
      calendarId: this.config.defaultCalendarId,
      timezone: this.config.timezone,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    // Encode booking data
    const encodedData = Buffer.from(JSON.stringify(bookingData)).toString("base64url");

    return `${baseUrl}/book?data=${encodedData}`;
  }

  /**
   * Parse a booking link to get slot data
   */
  parseBookingLink(url: string): BookingLinkData {
    try {
      const urlObj = new URL(url);
      const encodedData = urlObj.searchParams.get("data");

      if (!encodedData) {
        throw new Error("Missing data parameter");
      }

      const jsonData = Buffer.from(encodedData, "base64url").toString("utf-8");
      const parsed = JSON.parse(jsonData) as BookingLinkData;

      // Check expiry
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        throw new CalendarError("Booking link has expired", {
          calendarCode: CalendarErrorCode.INVALID_SLOT,
          statusCode: 400,
        });
      }

      return parsed;
    } catch (error) {
      if (error instanceof CalendarError) throw error;

      throw new CalendarError("Invalid booking link format", {
        calendarCode: CalendarErrorCode.INVALID_SLOT,
        statusCode: 400,
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Book a meeting from a booking link
   */
  async bookMeeting(
    bookingData: BookingLinkData,
    selectedSlotIndex: number,
    attendeeEmail: string,
    attendeeName?: string
  ): Promise<CalendarEvent> {
    const slot = bookingData.slots[selectedSlotIndex];

    if (!slot) {
      throw new CalendarError("Invalid slot selection", {
        calendarCode: CalendarErrorCode.INVALID_SLOT,
        statusCode: 400,
        context: { selectedSlotIndex, totalSlots: bookingData.slots.length },
      });
    }

    const eventInput: EventInput = {
      summary: bookingData.meetingConfig.title,
      description: bookingData.meetingConfig.description,
      start: new Date(slot.start),
      end: new Date(slot.end),
      location: bookingData.meetingConfig.location,
      attendees: [
        {
          email: attendeeEmail,
          displayName: attendeeName,
        },
      ],
      reminders: bookingData.meetingConfig.reminders,
      conferenceData: bookingData.meetingConfig.addConferenceLink
        ? { createRequest: true, provider: "googleMeet" }
        : undefined,
    };

    return this.createEvent(bookingData.calendarId, eventInput);
  }

  // ============================================
  // Timezone Utilities
  // ============================================

  /**
   * Convert a date to the user's timezone
   * Note: This is a simplified implementation. In production,
   * use a library like date-fns-tz or luxon.
   */
  convertToUserTimezone(date: Date): Date {
    // Simple implementation - returns date as-is
    // In production, this would use Intl.DateTimeFormat or similar
    return new Date(date);
  }

  /**
   * Convert a date from user's timezone to UTC
   */
  convertToUTC(date: Date): Date {
    // Simple implementation - returns date as-is
    // In production, this would use Intl.DateTimeFormat or similar
    return new Date(date);
  }

  /**
   * Get the configured timezone
   */
  getTimezone(): string {
    return this.config.timezone;
  }
}
