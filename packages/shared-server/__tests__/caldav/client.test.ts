/**
 * CalDAV Client Tests
 *
 * tsdav guards `createCalendarObject` with `If-None-Match: *`, so writing an
 * event over the uid it already occupies only works when that guard is lifted.
 */

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogin = vi.fn();
const mockFetchCalendars = vi.fn();
const mockCreateCalendarObject = vi.fn();

vi.mock("tsdav", () => ({
  default: {
    DAVClient: class {
      login = mockLogin;
      fetchCalendars = mockFetchCalendars;
      createCalendarObject = mockCreateCalendarObject;
    },
  },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { CalDavClient } = await import("../../src/caldav/client");

const CALENDAR = { url: "https://radicale.example/dav/chef/meals/", components: ["VEVENT"] };

function client() {
  return new CalDavClient({
    serverUrl: "https://radicale.example/dav",
    username: "chef",
    password: "secret",
  });
}

const EVENT = {
  summary: "Lasagne",
  start: new Date(Date.UTC(2026, 7, 21, 18, 0)),
  end: new Date(Date.UTC(2026, 7, 21, 19, 0)),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLogin.mockResolvedValue(undefined);
  mockFetchCalendars.mockResolvedValue([CALENDAR]);
  mockCreateCalendarObject.mockResolvedValue({
    ok: true,
    status: 201,
    headers: new Headers({ etag: '"1"' }),
  });
});

describe("createEvent", () => {
  it("keeps the guard that stops a create from clobbering an existing event", async () => {
    await client().createEvent({ ...EVENT, uid: "event-uid" });

    expect(mockCreateCalendarObject).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "event-uid.ics", headersToExclude: undefined })
    );
  });

  it("generates a uid when the caller has none", async () => {
    const created = await client().createEvent(EVENT);

    expect(created.uid).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects an event that ends before it starts", async () => {
    await expect(client().createEvent({ ...EVENT, end: EVENT.start })).rejects.toThrow(
      "createEvent: end must be after start"
    );
  });
});

describe("updateEvent", () => {
  it("drops If-None-Match so the write lands on the event it targets", async () => {
    const updated = await client().updateEvent({ ...EVENT, uid: "event-uid" });

    expect(updated.uid).toBe("event-uid");
    expect(mockCreateCalendarObject).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "event-uid.ics",
        headersToExclude: ["If-None-Match"],
      })
    );
  });

  it("carries the new time into the written calendar object", async () => {
    await client().updateEvent({
      ...EVENT,
      uid: "event-uid",
      start: new Date(Date.UTC(2026, 7, 25, 12, 0)),
      end: new Date(Date.UTC(2026, 7, 25, 13, 0)),
    });

    const { iCalString } = mockCreateCalendarObject.mock.calls[0]![0];

    expect(iCalString).toContain("UID:event-uid");
    // A floating time: 12:00 in whatever timezone the calendar is viewed in.
    expect(iCalString).toContain("DTSTART:20260825T120000\r\n");
    expect(iCalString).toContain("DTEND:20260825T130000\r\n");
    expect(iCalString).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
  });

  it("surfaces a rejected write", async () => {
    mockCreateCalendarObject.mockResolvedValue({
      ok: false,
      status: 412,
      text: () => Promise.resolve("Precondition Failed"),
      headers: new Headers(),
    });

    await expect(client().updateEvent({ ...EVENT, uid: "event-uid" })).rejects.toThrow(
      "CalDAV updateEvent failed 412: Precondition Failed"
    );
  });
});
