import type { WebConnectivityRuntime } from "@/lib/connectivity/runtime";
import { webConnectivityRuntime } from "@/lib/connectivity/runtime";

const BACKEND_UNAVAILABLE_STATUSES = new Set([502, 503, 504]);
const RECOVERY_CHECK_URL = "/api/auth/get-session?disableCookieCache=true";
const RECOVERY_CHECK_INIT: RequestInit = {
  cache: "no-store",
  credentials: "same-origin",
  headers: { accept: "application/json" },
};

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

export async function checkWebBackendReachability(
  transport: typeof fetch = (...args) => globalThis.fetch(...args)
): Promise<boolean> {
  try {
    const response = await transport(RECOVERY_CHECK_URL, RECOVERY_CHECK_INIT);

    return !BACKEND_UNAVAILABLE_STATUSES.has(response.status);
  } catch {
    return false;
  }
}

export async function confirmWebSessionSignedOut(
  transport: typeof fetch = (...args) => globalThis.fetch(...args)
): Promise<boolean> {
  try {
    const response = await transport(RECOVERY_CHECK_URL, RECOVERY_CHECK_INIT);

    if (!response.ok) return false;

    return (await response.json()) === null;
  } catch {
    return false;
  }
}

export function createWebTransportFetch(
  runtime: WebConnectivityRuntime = webConnectivityRuntime,
  transport: typeof fetch = (...args) => globalThis.fetch(...args)
): typeof fetch {
  return async (input, init) => {
    if (runtime.getSnapshot().simulatedBackendUnavailable) {
      runtime.reportHttpFailure();
      throw new TypeError("Failed to fetch: simulated backend unavailable");
    }

    try {
      const response = await transport(input, init);

      if (BACKEND_UNAVAILABLE_STATUSES.has(response.status)) {
        runtime.reportHttpFailure();
      } else {
        // Auth, authorization, and validation responses still prove HTTP reachability.
        runtime.reportHttpSuccess();
      }

      return response;
    } catch (error) {
      // Navigation and query cancellation intentionally abort requests. They do not
      // prove that the backend is unreachable.
      if (!isAbortError(error)) runtime.reportHttpFailure();
      throw error;
    }
  };
}

export const webTransportFetch = createWebTransportFetch();
