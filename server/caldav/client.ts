import type {
  CreateEventInput,
  CreatedEvent,
  CalDavClientOptions,
  ConnectionTestResult,
} from "@/types/dto/caldav";

import { v4 as uuidv4 } from "uuid";

import { buildIcs } from "./ics-helpers";

export type { CreateEventInput, CreatedEvent, CalDavClientOptions, ConnectionTestResult };

export class CalDavClient {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(opts: CalDavClientOptions) {
    this.baseUrl = opts.baseUrl.trim();
    this.username = opts.username;
    this.password = opts.password;

    if (!this.baseUrl) {
      throw new Error("CalDavClient: baseUrl is required");
    }
    if (!this.baseUrl.endsWith("/")) {
      this.baseUrl += "/";
    }
    if (!this.username || !this.password) {
      throw new Error("CalDavClient: username and password are required");
    }
  }

  private getAuthHeader(): string {
    return "Basic " + Buffer.from(`${this.username}:${this.password}`, "utf8").toString("base64");
  }

  /**
   * Test connection to the CalDAV server using PROPFIND.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "PROPFIND",
        headers: {
          Authorization: this.getAuthHeader(),
          Depth: "0",
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Connection failed: ${response.status} ${response.statusText}`,
        };
      }

      return {
        success: true,
        message: "Connection successful",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  async createEvent(input: CreateEventInput): Promise<CreatedEvent> {
    if (input.end <= input.start) {
      throw new Error("createEvent: end must be after start");
    }

    const uid = input.uid || uuidv4();
    const ics = buildIcs({ ...input, uid });
    const href = this.baseUrl + uid + ".ics";

    const res = await fetch(href, {
      method: "PUT",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "text/calendar; charset=utf-8",
        "If-None-Match": "*",
      },
      body: ics,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");

      throw new Error(`CalDAV createEvent failed ${res.status} ${res.statusText}: ${text}`);
    }

    return {
      uid,
      href,
      etag: res.headers.get("ETag") || undefined,
      rawIcs: ics,
    };
  }

  async deleteEvent(eventUid: string): Promise<void> {
    const href = this.baseUrl + eventUid + ".ics";

    const response = await fetch(href, {
      method: "DELETE",
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`CalDAV deleteEvent failed ${response.status} ${response.statusText}`);
    }
  }
}

export async function testCalDavConnection(
  serverUrl: string,
  username: string,
  password: string
): Promise<ConnectionTestResult> {
  try {
    const client = new CalDavClient({ baseUrl: serverUrl, username, password });

    return client.testConnection();
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Invalid configuration",
    };
  }
}
