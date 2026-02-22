export interface CreateEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  uid?: string;
  url?: string;
  location?: string;
}

export interface CreatedEvent {
  uid: string;
  href: string;
  etag?: string;
  rawIcs: string;
}

export interface CalDavClientOptions {
  /** Base CalDAV server URL for discovery (e.g., https://dav.example.com/) */
  serverUrl: string;
  /** Specific calendar URL to use for operations (optional, falls back to first calendar) */
  calendarUrl?: string;
  username: string;
  password: string;
}

export interface CalDavCalendarInfo {
  url: string;
  displayName: string;
  description?: string;
  ctag?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  /** Available calendars (only returned on successful connection) */
  calendars?: CalDavCalendarInfo[];
}
