type SessionInvalidationReason = "transport-unauthorized" | "websocket-unauthorized";

type SessionInvalidationHandler = (reason: SessionInvalidationReason) => Promise<void>;

type AuthTransportSnapshot = {
  hasActiveSession: boolean;
  version: number;
};

const listeners = new Set<() => void>();

let snapshot: AuthTransportSnapshot = {
  hasActiveSession: false,
  version: 0,
};

let invalidationHandler: SessionInvalidationHandler | null = null;
let invalidationPromise: Promise<void> | null = null;

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

export function setHasActiveSession(hasActiveSession: boolean): void {
  if (snapshot.hasActiveSession === hasActiveSession) {
    return;
  }

  snapshot = {
    hasActiveSession,
    version: snapshot.version + 1,
  };

  emitSnapshotChange();
}

export function registerSessionInvalidationHandler(
  handler: SessionInvalidationHandler | null
): () => void {
  invalidationHandler = handler;

  return () => {
    if (invalidationHandler === handler) {
      invalidationHandler = null;
    }
  };
}

export async function invalidateSession(reason: SessionInvalidationReason): Promise<void> {
  if (!invalidationHandler) {
    return;
  }

  if (!invalidationPromise) {
    invalidationPromise = invalidationHandler(reason).finally(() => {
      invalidationPromise = null;
    });
  }

  await invalidationPromise;
}
