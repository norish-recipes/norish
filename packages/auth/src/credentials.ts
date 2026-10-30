import { getSessionCookie } from "better-auth/cookies";

/** The headers an API key arrives in, for the API key plugin and the proxy alike. */
export const API_KEY_HEADERS = ["x-api-key", "bearer"] as const;

/**
 * Whether the request carries a credential at all: a session cookie or an API
 * key. An optimistic check that reads nothing and decrypts nothing, so
 * whatever serves data still checks the credential behind it.
 */
export function hasCredential(headers: Headers): boolean {
  return getSessionCookie(headers) !== null || API_KEY_HEADERS.some((name) => headers.has(name));
}
