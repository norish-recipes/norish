import type { SessionCookies } from "./auth";
import { withDatabase } from "./database";
import { callTrpc } from "./trpc";

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
  await callTrpc(baseURL, cookies, "user.setDevicePreferences", { kind, preferences });
}

/** The reader's stored preferences document as the profile query returns it. */
export async function readProfilePreferences(
  baseURL: string,
  cookies: SessionCookies
): Promise<Record<string, unknown>> {
  const { user } = await callTrpc<{ user: { preferences?: Record<string, unknown> } }>(
    baseURL,
    cookies,
    "user.get"
  );

  return user.preferences ?? {};
}

/** Forget every reader's Device Preferences, so a scenario starts from the defaults. */
export async function clearDevicePreferences(databaseUrl: string): Promise<void> {
  await withDatabase(databaseUrl, (database) =>
    database.query(`update "user" set preferences = preferences - 'phone' - 'desktop'`)
  );
}
