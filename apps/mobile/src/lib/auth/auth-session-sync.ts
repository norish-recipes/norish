import { useSyncExternalStore } from "react";

type AuthTransportSnapshot = {
  hasActiveSession: boolean;
  version: number;
};

const listeners = new Set<() => void>();

let snapshot: AuthTransportSnapshot = {
  hasActiveSession: false,
  version: 0,
};

/** How long the signed-in screen fades out for before a session's end unmounts it. */
export const SESSION_END_FADE_MS = 240;

// Whether the signed-in screen is fading out ahead of a session's end; until leave.
let fadingOut = false;

// The Server Address a session just ended on; module scope, so it outlives leave's re-key.
let leftFrom: string | null = null;

function emitSnapshotChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getAuthTransportSnapshot(): AuthTransportSnapshot {
  return snapshot;
}

export function subscribeAuthTransport(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// The account the tree below the tRPC provider renders for: null signed out, undefined not known yet.
let keyedFor: string | null | undefined;

/**
 * Whether a session settling on `next` re-keys the tree rendered for `rendered`: only when it
 * rendered another account or signed out, never when it first learns the account it shows.
 */
export function rekeysOnSettle(rendered: string | null | undefined, next: string | null): boolean {
  return rendered !== undefined && rendered !== next;
}

/** Signed in as `userId`; re-keys only when the tree rendered signed out or another account. */
export function publishSignedIn(userId: string): void {
  const rekey = rekeysOnSettle(keyedFor, userId);

  keyedFor = userId;
  if (snapshot.hasActiveSession && !rekey) return;

  leftFrom = null;
  snapshot = { hasActiveSession: true, version: snapshot.version + (rekey ? 1 : 0) };

  emitSnapshotChange();
}

/** The tree renders signed out, so the next sign-in re-keys it; a signed-in tree ends only through leave. */
export function noteSignedOut(): void {
  if (!snapshot.hasActiveSession) keyedFor = null;
}

/** Mobile's leave: signed out and one re-key, so everything below rebuilds on the cleared cache. */
export function publishSignedOut(serverAddress: string | null): void {
  leftFrom = serverAddress;
  keyedFor = null;
  fadingOut = false;
  snapshot = { hasActiveSession: false, version: snapshot.version + 1 };

  emitSnapshotChange();
}

/** The Server Address a Sign-out or Session Expiry left, once; the signed-out entry's first render takes it. */
export function takeSessionLeft(): string | null {
  const left = leftFrom;

  leftFrom = null;

  return left;
}

/** Whether a session is live; readable in onboarding too, which has no platform adapter. */
export function useHasActiveSession(): boolean {
  return useSyncExternalStore(subscribeAuthTransport, getAuthTransportSnapshot).hasActiveSession;
}

/** Fades the signed-in screen out, resolving once it is gone. */
export function fadeOutSignedIn(): Promise<void> {
  fadingOut = true;
  emitSnapshotChange();

  return new Promise((resolve) => setTimeout(resolve, SESSION_END_FADE_MS));
}

/** Whether the signed-in screen is fading out ahead of a session's end. */
export function useSignedInFadingOut(): boolean {
  return useSyncExternalStore(subscribeAuthTransport, () => fadingOut);
}
