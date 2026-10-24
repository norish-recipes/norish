import { addBasePath, APP_ROOT } from "@norish/shared/lib/base-path";

/**
 * The header the proxy forwards a request's path and query in, so a page
 * that finds no session can send the reader to sign in and back again.
 */
export const DESTINATION_HEADER = "x-norish-destination";

/** The login page, returning to `destination` once signed in; only the callback carries the base path. */
export function loginPath(destination: string | null): string {
  const callbackUrl = destination ? addBasePath(destination) : APP_ROOT;

  return `/login?${new URLSearchParams({ callbackUrl })}`;
}
