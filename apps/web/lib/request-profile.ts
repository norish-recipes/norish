import "server-only";

import type { DevicePreferencesSeed } from "@/context/device-preferences-context";
import { cache } from "react";
import { headers } from "next/headers";

import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import { readSessionPrincipal, verifySessionPrincipal } from "@norish/auth/session";
import { getUserPreferences } from "@norish/db/repositories/users";
import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";
import { deviceKindFromUserAgent } from "@norish/shared/lib/device-kind";

const NO_PREFERENCES: UserPreferencesDto = {};

/**
 * The request's profile, read once: the verified session, the stored
 * preferences document and the request's Device Kind. The signed-in layout's
 * gate, the settings page, the locale lookup and the Device Preferences share
 * it. A session whose account no longer exists is revoked and reads as signed
 * out.
 */
export const readRequestProfile = cache(async () => {
  const requestHeaders = await headers();
  const kind = deviceKindFromUserAgent(requestHeaders.get("user-agent"));
  // An unreadable session is a signed-out request.
  const principal = await readSessionPrincipal(requestHeaders).catch(() => null);
  const signedOut = { identity: null, userId: null, kind, preferences: NO_PREFERENCES };

  if (!principal) return signedOut;

  // The account is checked while the preferences are read, not before.
  const [identity, preferences] = await Promise.all([
    verifySessionPrincipal(principal),
    getUserPreferences(principal.userId),
  ]);

  return identity ? { identity, userId: identity.id, kind, preferences } : signedOut;
});

export async function readDevicePreferencesSeed(): Promise<DevicePreferencesSeed> {
  const { userId, kind, preferences } = await readRequestProfile();

  return {
    kind,
    values: preferences[kind] ?? DEVICE_PREFERENCE_DEFAULTS,
    signedIn: userId !== null,
  };
}
