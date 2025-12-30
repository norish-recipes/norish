import type {
  CreateEventInput,
  CreatedEvent,
  CalDavClientOptions,
  ConnectionTestResult,
  CalDavCalendarInfo,
} from "@/types/dto/caldav";

import { DAVClient, DAVCalendar } from "tsdav";
import { v4 as uuidv4 } from "uuid";

import { buildIcs } from "./ics-helpers";

import { createLogger } from "@/server/logger";

export type { CreateEventInput, CreatedEvent, CalDavClientOptions, ConnectionTestResult };

const log = createLogger("caldav-client");

export class CalDavClient {
  private serverUrl: string;
  private calendarUrl: string | undefined;
  private username: string;
  private password: string;
  private client: DAVClient;
  private _calendars: DAVCalendar[] | null = null;

  constructor(opts: CalDavClientOptions) {
    this.serverUrl = opts.serverUrl.trim();
    this.calendarUrl = opts.calendarUrl?.trim();
    this.username = opts.username;
    this.password = opts.password;

    if (!this.serverUrl) {
      throw new Error("CalDavClient: serverUrl is required");
    }
    if (!this.username || !this.password) {
      throw new Error("CalDavClient: username and password are required");
    }

    // Ensure serverUrl ends with /
    if (!this.serverUrl.endsWith("/")) {
      this.serverUrl += "/";
    }

    this.client = new DAVClient({
      serverUrl: this.serverUrl,
      credentials: {
        username: this.username,
        password: this.password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
  }

  /**
   * Login and fetch calendars (cached after first call)
   * Only returns calendars that support VEVENT (not task lists)
   */
  private async ensureLoggedIn(): Promise<DAVCalendar[]> {
    if (this._calendars) {
      return this._calendars;
    }

    await this.client.login();
    const allCalendars = await this.client.fetchCalendars();

    // Filter to only calendars that support VEVENT (not VTODO task lists)
    this._calendars = allCalendars.filter((cal) => {
      // If components is not defined, assume it's a calendar
      if (!cal.components || cal.components.length === 0) {
        return true;
      }
      // Only include calendars that support VEVENT
      return cal.components.includes("VEVENT");
    });

    log.debug(
      {
        total: allCalendars.length,
        filtered: this._calendars.length,
        excluded: allCalendars
          .filter((c) => c.components && !c.components.includes("VEVENT"))
          .map((c) => c.displayName),
      },
      "Fetched and filtered calendars"
    );

    return this._calendars;
  }

  /**
   * Get the target calendar for operations
   */
  private async getTargetCalendar(): Promise<DAVCalendar> {
    const calendars = await this.ensureLoggedIn();

    if (calendars.length === 0) {
      throw new Error("No calendars found on the server");
    }

    // If calendarUrl is specified, find that calendar
    if (this.calendarUrl) {
      const target = calendars.find((c) => c.url === this.calendarUrl);

      if (target) {
        return target;
      }

      log.warn(
        { calendarUrl: this.calendarUrl, available: calendars.map((c) => c.url) },
        "Specified calendar not found, falling back to first calendar"
      );
    }

    // Fall back to first calendar
    return calendars[0];
  }

  /**
   * Test connection and return available calendars
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const calendars = await this.ensureLoggedIn();

      return {
        success: true,
        message: `Connected successfully. Found ${calendars.length} calendar(s).`,
        calendars: calendars.map((cal) => ({
          url: cal.url,
          displayName: typeof cal.displayName === "string" ? cal.displayName : "Unnamed Calendar",
          description: cal.description,
          ctag: cal.ctag,
        })),
      };
    } catch (error) {
      log.error({ err: error }, "CalDAV connection test failed");

      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Fetch available calendars
   */
  async fetchCalendars(): Promise<CalDavCalendarInfo[]> {
    const calendars = await this.ensureLoggedIn();

    return calendars.map((cal) => ({
      url: cal.url,
      displayName: typeof cal.displayName === "string" ? cal.displayName : "Unnamed Calendar",
      description: cal.description,
      ctag: cal.ctag,
    }));
  }

  async createEvent(input: CreateEventInput): Promise<CreatedEvent> {
    if (input.end <= input.start) {
      throw new Error("createEvent: end must be after start");
    }

    const uid = input.uid || uuidv4();
    const ics = buildIcs({ ...input, uid });
    const filename = `${uid}.ics`;

    const targetCalendar = await this.getTargetCalendar();

    log.debug(
      { calendarUrl: targetCalendar.url, uid, summary: input.summary },
      "Creating CalDAV event"
    );

    const response = await this.client.createCalendarObject({
      calendar: targetCalendar,
      iCalString: ics,
      filename,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");

      log.error(
        {
          status: response.status,
          calendarUrl: targetCalendar.url,
          calendarDisplayName: targetCalendar.displayName,
          configuredCalendarUrl: this.calendarUrl,
          responseText: text,
        },
        "CalDAV createEvent failed"
      );

      throw new Error(`CalDAV createEvent failed ${response.status}: ${text}`);
    }

    const etag = response.headers.get("etag") || undefined;
    const href = `${targetCalendar.url}${filename}`;

    log.debug({ uid, href, etag }, "CalDAV event created successfully");

    return {
      uid,
      href,
      etag,
      rawIcs: ics,
    };
  }

  async deleteEvent(eventUid: string): Promise<void> {
    const targetCalendar = await this.getTargetCalendar();

    log.debug({ calendarUrl: targetCalendar.url, eventUid }, "Deleting CalDAV event");

    // Fetch events to find the one to delete
    const events = await this.client.fetchCalendarObjects({
      calendar: targetCalendar,
    });

    const eventToDelete = events.find((e) => e.data?.includes(`UID:${eventUid}`));

    if (!eventToDelete) {
      log.debug({ eventUid }, "Event not found on server, skipping delete");

      return;
    }

    const response = await this.client.deleteCalendarObject({
      calendarObject: eventToDelete,
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`CalDAV deleteEvent failed ${response.status}`);
    }

    log.debug({ eventUid }, "CalDAV event deleted successfully");
  }
}

/**
 * Test CalDAV connection without saving config
 */
export async function testCalDavConnection(
  serverUrl: string,
  username: string,
  password: string
): Promise<ConnectionTestResult> {
  try {
    const client = new CalDavClient({ serverUrl, username, password });

    return client.testConnection();
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invalid configuration",
    };
  }
}

/**
 * Fetch available calendars from a CalDAV server
 */
export async function fetchCalDavCalendars(
  serverUrl: string,
  username: string,
  password: string
): Promise<CalDavCalendarInfo[]> {
  const client = new CalDavClient({ serverUrl, username, password });

  return client.fetchCalendars();
}
