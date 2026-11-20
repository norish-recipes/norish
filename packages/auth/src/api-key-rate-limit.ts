import { createHash } from "node:crypto";
import { APIError } from "better-auth/api";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getPublisherClient } from "@norish/shared-server/valkey/client";

import { valkeySecondaryStorage } from "./secondary-storage";

export function apiKeyRateLimited(retryAfterSeconds: number): APIError {
  return new APIError(
    "TOO_MANY_REQUESTS",
    { message: "Rate limit exceeded.", code: "RATE_LIMITED" },
    { "Retry-After": String(retryAfterSeconds) }
  );
}

/**
 * Counts an API key's requests in fixed windows, an hour by default. Better Auth's limit
 * restarts its hour at every request, so a steady poller never got a new one.
 */
export async function consumeApiKeyRequest(key: string): Promise<true> {
  const counter = `api-key-rate:${createHash("sha256").update(key).digest("base64url")}`;
  const count = await valkeySecondaryStorage.increment(
    counter,
    SERVER_CONFIG.API_KEY_RATE_LIMIT_WINDOW
  );

  if (count <= SERVER_CONFIG.API_KEY_RATE_LIMIT_MAX) {
    return true;
  }

  const ttl = await (await getPublisherClient()).ttl(counter);

  throw apiKeyRateLimited(Math.max(ttl, 1));
}

/** Seconds a rate-limited API key waits, or null when the error is anything else. */
export function apiKeyRetryAfter(error: unknown): string | null {
  if (!(error instanceof APIError) || error.body?.code !== "RATE_LIMITED") {
    return null;
  }

  return new Headers(error.headers).get("Retry-After");
}
