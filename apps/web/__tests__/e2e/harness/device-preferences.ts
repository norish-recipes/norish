import { getAllUserIds, updateUserPreferences } from "@norish/db/repositories/users";

import type { SessionCookies } from "./auth";
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

/** The reader's Device Preferences as their query returns them, one block per kind. */
export async function readDevicePreferences(
  baseURL: string,
  cookies: SessionCookies
): Promise<Record<DeviceKind, Record<string, unknown>>> {
  return callTrpc(baseURL, cookies, "user.getDevicePreferences");
}

/** Forget every reader's Device Preferences, so a scenario starts from the defaults. */
export async function clearDevicePreferences(): Promise<void> {
  for (const userId of await getAllUserIds()) {
    await updateUserPreferences(userId, { phone: {}, desktop: {} });
  }
}
