import type { WebConnectivityRuntime } from "./runtime";
import { webConnectivityRuntime } from "./runtime";

const BACKEND_UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

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
      runtime.reportHttpFailure();
      throw error;
    }
  };
}

export const webTransportFetch = createWebTransportFetch();
