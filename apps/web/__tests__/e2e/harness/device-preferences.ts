import { request } from "@playwright/test";

import type { SessionCookies } from "./auth";
import { withDatabase } from "./database";

/** Safari on an iPhone: its `Mobi` token makes the request a phone. */
export const IPHONE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** Chrome on a Mac: a desktop. */
export const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export type DeviceKind = "phone" | "desktop";

/** Set Device Preferences for one kind through the real API, as the signed-in reader. */
export async function setDevicePreferences(
  baseURL: string,
  cookies: SessionCookies,
  kind: DeviceKind,
  preferences: Record<string, unknown>
): Promise<void> {
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const response = await api.post("/api/trpc/user.setDevicePreferences", {
      data: { json: { kind, preferences } },
    });

    if (!response.ok()) throw new Error(`setDevicePreferences failed: ${response.status()}`);
  } finally {
    await api.dispose();
  }
}

/** The reader's stored preferences document as the profile query returns it. */
export async function readProfilePreferences(
  baseURL: string,
  cookies: SessionCookies
): Promise<Record<string, unknown>> {
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const response = await api.get("/api/trpc/user.get");

    if (!response.ok()) throw new Error(`user.get failed: ${response.status()}`);

    const body = (await response.json()) as {
      result: { data: { json: { user: { preferences?: Record<string, unknown> } } } };
    };

    return body.result.data.json.user.preferences ?? {};
  } finally {
    await api.dispose();
  }
}

/** Forget every reader's Device Preferences, so a scenario starts from the defaults. */
export async function clearDevicePreferences(databaseUrl: string): Promise<void> {
  await withDatabase(databaseUrl, (database) =>
    database.query(`update "user" set preferences = preferences - 'phone' - 'desktop'`)
  );
}
