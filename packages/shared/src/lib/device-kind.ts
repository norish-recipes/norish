import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

/**
 * The Device Kind a user agent belongs to: a `Mobi` token means phone,
 * anything else desktop. Chromium's reduced user agent keeps the token on
 * phones, Android tablets leave it out, and iPad Safari sends a Mac user
 * agent, so tablets land as desktops. The server applies this to each
 * request and the browser to itself when it starts Offline, so the kind is
 * never stored or sent.
 */
export function deviceKindFromUserAgent(userAgent: string | null | undefined): DeviceKind {
  return userAgent?.includes("Mobi") ? "phone" : "desktop";
}
