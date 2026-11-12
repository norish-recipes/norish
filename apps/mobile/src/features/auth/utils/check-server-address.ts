import { classifyServerHealth, serverVersionOf } from "@/features/auth/utils/server-version";
import { getServerHealthUrl, normalizeServerAddress } from "@/lib/network/server-address";

import { REACHABILITY_DEADLINE_MS } from "@norish/shared-react/offline/reachability";

export type ServerAddressErrorId =
  "auth.connect.errors.invalidUrl" | "auth.connect.errors.unreachable";

export type ServerAddressCheck =
  | { outcome: "ok"; address: string }
  /** `version` is what the server reported, when it reported one. */
  | { outcome: "too-old"; address: string; version?: string }
  | { outcome: "error"; messageId: ServerAddressErrorId };

/** Asks the server at `input` what it is; anything but a Norish answer is one inline error. */
export async function checkServerAddress(
  input: string,
  fetcher: typeof fetch = fetch
): Promise<ServerAddressCheck> {
  const address = normalizeServerAddress(input);

  if (!address) return { outcome: "error", messageId: "auth.connect.errors.invalidUrl" };

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
      return { outcome: "error", messageId: "auth.connect.errors.unreachable" };
    }

    return verdict === "ok"
      ? { outcome: "ok", address }
      : { outcome: "too-old", address, version: serverVersionOf(health) };
  } catch {
    return { outcome: "error", messageId: "auth.connect.errors.unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}
