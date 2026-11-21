import type { ServerAddressCheck } from "@/lib/network/server-address";
import { classifyServerHealth, serverVersionOf } from "@/features/auth/utils/server-version";
import { getServerHealthUrl, normalizeServerAddress } from "@/lib/network/server-address";

import { REACHABILITY_DEADLINE_MS } from "@norish/shared-react/offline/reachability";

const ERROR_MESSAGE_IDS = {
  invalid: "auth.connect.errors.invalidUrl",
  unreachable: "auth.connect.errors.unreachable",
} as const;

/** The message a failed check shows under the Server Address field. */
export function serverAddressErrorId(reason: keyof typeof ERROR_MESSAGE_IDS) {
  return ERROR_MESSAGE_IDS[reason];
}

/** Asks the server at `input` what it is; anything but a Norish answer is one inline error. */
export async function checkServerAddress(
  input: string,
  fetcher: typeof fetch = fetch
): Promise<ServerAddressCheck> {
  const address = normalizeServerAddress(input);

  if (!address) return { outcome: "error", reason: "invalid" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REACHABILITY_DEADLINE_MS);

  try {
    // The deprecated route, since servers before 0.26 have no /health/ready to answer.
    const response = await fetcher(getServerHealthUrl(address), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    const health: unknown = response.ok ? await response.json().catch(() => null) : null;
    const verdict = classifyServerHealth(health);

    if (verdict === "not-norish") {
      return { outcome: "error", reason: "unreachable" };
    }

    return verdict === "ok"
      ? { outcome: "ok", address }
      : { outcome: "too-old", address, version: serverVersionOf(health) };
  } catch {
    return { outcome: "error", reason: "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}
