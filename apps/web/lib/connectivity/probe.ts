/**
 * Backend reachability probe.
 *
 * The single source of truth for the Live/Offline verdict: a short, uncached
 * GET against the public health endpoint. `res.ok` (2xx) means Live; a non-2xx
 * response, a network error, or a timeout all mean Offline.
 *
 * The endpoint is public (`protect: false`) so no session is required, and the
 * request is deliberately uncacheable — `cache: "no-store"` plus a per-call
 * cache-busting query param — so a stale service-worker cache entry can never
 * lie about the backend being up.
 */

/** Public OpenAPI health route (see `packages/trpc` config router). */
export const HEALTH_PROBE_PATH = "/api/v1/health";

/** Give up on a single probe after this long; a hung request counts as Offline. */
export const HEALTH_PROBE_TIMEOUT_MS = 5_000;

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

export async function probeBackendReachable(options: ProbeOptions = {}): Promise<boolean> {
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
    const response = await fetchImpl(`${HEALTH_PROBE_PATH}?_probe=${now()}`, {
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
