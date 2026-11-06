// The Live/Offline verdict: a 2xx from the public readiness route is Live, anything else Offline.
// `no-store` plus a per-call query param keep a service-worker copy from answering for the server.

import { REACHABILITY_DEADLINE_MS } from "./reachability";

/** The public readiness route: Live means Postgres and Valkey answer, whatever the parser does. */
export const HEALTH_PROBE_PATH = "/api/v1/health/ready";

/** Give up on a single probe after this long; a hung request counts as Offline. */
export const HEALTH_PROBE_TIMEOUT_MS = REACHABILITY_DEADLINE_MS;

export interface ProbeOptions {
  /** Abort the probe from the outside (e.g. on unmount). */
  signal?: AbortSignal;
  /** Override the per-probe timeout. */
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable clock for the cache-busting param (tests). */
  now?: () => number;
}

export async function probeBackendReachable(
  url: string,
  options: ProbeOptions = {}
): Promise<boolean> {
  const {
    signal,
    timeoutMs = HEALTH_PROBE_TIMEOUT_MS,
    fetchImpl = fetch,
    now = Date.now,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetchImpl(`${url}?_probe=${now()}`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      headers: { "cache-control": "no-cache" },
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
