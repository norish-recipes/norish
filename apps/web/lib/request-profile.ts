import "server-only";

import type { DevicePreferencesSeed } from "@/context/device-preferences-context";
import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@norish/auth/auth";
import { getUserPreferences } from "@norish/db/repositories/users";
import { parseDevicePreferences } from "@norish/shared/contracts/zod/device-preferences";
import { deviceKindFromUserAgent } from "@norish/shared/lib/device-kind";

/**
 * The request's profile, read once: the session, the stored preferences
 * document and the request's Device Kind. The locale lookup and the Device
 * Preferences share it.
 */
export const readRequestProfile = cache(async () => {
  const requestHeaders = await headers();
  const kind = deviceKindFromUserAgent(requestHeaders.get("user-agent"));
  let userId: string | null = null;

  try {
    const session = await auth.api.getSession({ headers: requestHeaders });

    userId = session?.user?.id ?? null;
  } catch {
    // An unreadable session is a signed-out request.
  }

  const preferences = userId ? await getUserPreferences(userId) : {};

  return { userId, kind, preferences };
});

export async function readDevicePreferencesSeed(): Promise<DevicePreferencesSeed> {
  const { userId, kind, preferences } = await readRequestProfile();

  return {
    kind,
    values: parseDevicePreferences(preferences[kind]),
    signedIn: userId !== null,
  };
}
