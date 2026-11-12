type AuthTransportSnapshot = {
  hasActiveSession: boolean;
  version: number;
};

const listeners = new Set<() => void>();

let snapshot: AuthTransportSnapshot = {
  hasActiveSession: false,
  version: 0,
};

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

/** Mobile's reload: re-keys the tRPC provider, so everything below rebuilds on the cleared cache. */
export function reloadAuthTransport(): void {
  snapshot = { ...snapshot, version: snapshot.version + 1 };

  emitSnapshotChange();
}
