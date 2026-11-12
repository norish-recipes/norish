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

/** Signed in, with one re-key so everything below rebuilds on the session; once until leave. */
export function publishSignedIn(): void {
  if (snapshot.hasActiveSession) return;

  leftFrom = null;
  snapshot = { hasActiveSession: true, version: snapshot.version + 1 };

  emitSnapshotChange();
}

/** Mobile's leave: signed out and one re-key, so everything below rebuilds on the cleared cache. */
export function publishSignedOut(serverAddress: string | null): void {
  leftFrom = serverAddress;
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
