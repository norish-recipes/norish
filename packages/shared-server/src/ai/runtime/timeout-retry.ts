import { aiLogger } from "@norish/shared-server/logger";

import { isTimedOut } from "./errors";

/**
 * Requests to AI that, between them, are asked once more after the first that runs out of time;
 * any other failure, or a second timeout, is thrown.
 */
export function onceMoreOnTimeout(feature: string) {
  let retried = false;

  return async <T>(request: () => Promise<T>): Promise<T> => {
    try {
      return await request();
    } catch (error) {
      if (retried || !isTimedOut(error)) throw error;
      retried = true;
      aiLogger.warn({ feature }, "A request timed out, asking once more");

      return await request();
    }
  };
}
