import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { addressesOf, isPrivate } from "@norish/shared-server/private-addresses";

/** Bring!'s own API. A different BRING_API_URL means a test double or a proxy stands in for it. */
const DEFAULT_BRING_API_URL = "https://api.getbring.com";

function withoutTrailingSlash(url: string): string {
  let trimmed = url;

  while (trimmed.endsWith("/")) trimmed = trimmed.slice(0, -1);

  return trimmed;
}

/** Whether Bring!'s real API is the one in use, as opposed to a test double or a proxy. */
export function usesDefaultBringApi(): boolean {
  return withoutTrailingSlash(SERVER_CONFIG.BRING_API_URL) === DEFAULT_BRING_API_URL;
}

/** AUTH_URL without a trailing slash: the origin and base path every public link starts from. */
export function publicBaseUrl(): string {
  return withoutTrailingSlash(SERVER_CONFIG.AUTH_URL);
}

/** The page Bring!'s servers fetch for a handoff. */
export function handoffUrl(token: string): string {
  return `${publicBaseUrl()}/share/bring/${token}`;
}

/** Where that page serves the recipe's own picture, when the instance stores it. */
export function handoffImageUrl(token: string): string {
  return `${handoffUrl(token)}/image`;
}

/**
 * Whether Bring!'s servers can plausibly reach this instance: AUTH_URL is https and is not, and
 * does not resolve to, a private address. The check is skipped only when BRING_API_URL points
 * somewhere other than Bring! (a test double or a proxy), whose fetch need not come from the internet.
 */
export async function isPubliclyReachable(): Promise<boolean> {
  if (!usesDefaultBringApi()) return true;

  const url = new URL(SERVER_CONFIG.AUTH_URL);

  if (url.protocol !== "https:") return false;

  const addresses = await addressesOf(url.hostname).catch(() => null);

  return addresses !== null && addresses.length > 0 && !addresses.some(isPrivate);
}
