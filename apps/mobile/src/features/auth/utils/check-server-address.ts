import { classifyServerHealth } from "@/features/auth/utils/server-version";
import { getServerHealthUrl, normalizeServerAddress } from "@/lib/network/server-address";

import { REACHABILITY_DEADLINE_MS } from "@norish/shared-react/offline/reachability";

type ServerAddressCheck =
  | { outcome: "ok" | "too-old"; address: string }
  | {
      outcome: "error";
      messageId: "auth.connect.errors.invalidUrl" | "auth.connect.errors.unreachable";
    };

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
    const verdict = response.ok
      ? classifyServerHealth(await response.json().catch(() => null))
      : "not-norish";

    return verdict === "not-norish"
      ? { outcome: "error", messageId: "auth.connect.errors.unreachable" }
      : { outcome: verdict, address };
  } catch {
    return { outcome: "error", messageId: "auth.connect.errors.unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}
