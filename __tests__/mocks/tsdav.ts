import { vi } from "vitest";

// Mock DAVClient class from tsdav
export const mockLogin = vi.fn().mockResolvedValue(undefined);
export const mockFetchCalendars = vi.fn().mockResolvedValue([
  {
    url: "https://caldav.example.com/calendars/user/default/",
    displayName: "Default Calendar",
    description: "Main calendar",
    ctag: "abc123",
  },
  {
    url: "https://caldav.example.com/calendars/user/meals/",
    displayName: "Meals",
    description: "Meal planning calendar",
    ctag: "def456",
  },
]);
export const mockFetchCalendarObjects = vi.fn().mockResolvedValue([]);
export const mockCreateCalendarObject = vi.fn().mockResolvedValue({
  ok: true,
  status: 201,
  headers: new Map([["etag", '"abc123"']]),
  text: vi.fn().mockResolvedValue(""),
});
export const mockDeleteCalendarObject = vi.fn().mockResolvedValue({
  ok: true,
  status: 204,
});

export class DAVClient {
  serverUrl: string;
  credentials: { username: string; password: string };
  authMethod: string;
  defaultAccountType: string;

  constructor(opts: {
    serverUrl: string;
    credentials: { username: string; password: string };
    authMethod: string;
    defaultAccountType: string;
  }) {
    this.serverUrl = opts.serverUrl;
    this.credentials = opts.credentials;
    this.authMethod = opts.authMethod;
    this.defaultAccountType = opts.defaultAccountType;
  }

  login = mockLogin;
  fetchCalendars = mockFetchCalendars;
  fetchCalendarObjects = mockFetchCalendarObjects;
  createCalendarObject = mockCreateCalendarObject;
  deleteCalendarObject = mockDeleteCalendarObject;
}

export const resetMocks = () => {
  mockLogin.mockClear();
  mockFetchCalendars.mockClear();
  mockFetchCalendarObjects.mockClear();
  mockCreateCalendarObject.mockClear();
  mockDeleteCalendarObject.mockClear();
};

export default { DAVClient };
