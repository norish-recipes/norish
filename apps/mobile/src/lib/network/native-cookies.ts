import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("native-cookies");

interface NetworkingSpec extends TurboModule {
  clearCookies: (callback: (result: boolean) => void) => void;
}

/** Empties the native cookie jar: React Native puts its cookies ahead of the session header on
 * every WebSocket and credentialed fetch, and the joined header reads as no session. */
export function clearNativeCookies(): Promise<void> {
  const networking = TurboModuleRegistry.get<NetworkingSpec>("Networking");

  if (!networking) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      networking.clearCookies(() => resolve());
    } catch (error) {
      log.warn({ error }, "Could not clear the native cookie jar");
      resolve();
    }
  });
}
