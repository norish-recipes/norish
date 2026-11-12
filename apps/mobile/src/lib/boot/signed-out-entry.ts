/** The signed-out stack's first screen. */
export type SignedOutEntry = "server-address" | "sign-in";

/**
 * Sign in once a Server Address is saved, decided before the first frame so nothing slides
 * over it; Server address when none is saved or the reader asked to change it.
 */
export function resolveSignedOutEntry(
  serverAddress: string,
  changeRequested: boolean
): SignedOutEntry {
  return serverAddress && !changeRequested ? "sign-in" : "server-address";
}

/**
 * The screen a Sign-out or Session Expiry lands on (Sign in, or Server address after the chip's
 * Sign-out) fades in once, for the Server Address the session left.
 */
export function fadesInAfterSessionEnd(leftFrom: string | null, serverAddress: string): boolean {
  return leftFrom !== null && leftFrom === serverAddress;
}
