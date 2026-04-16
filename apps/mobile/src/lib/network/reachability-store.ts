export type ReachabilityMode = "offline" | "backend-unreachable" | "online";
export type ReachabilityRuntimeState = "initializing" | "ready";

export type ReachabilitySnapshot = {
  appOnline: boolean;
  mode: ReachabilityMode;
  runtimeState: ReachabilityRuntimeState;
};

const DEFAULT_REACHABILITY_SNAPSHOT: ReachabilitySnapshot = {
  appOnline: false,
  mode: "offline",
  runtimeState: "initializing",
};

let snapshot: ReachabilitySnapshot = { ...DEFAULT_REACHABILITY_SNAPSHOT };
type ReachabilityListener = (
  snapshot: ReachabilitySnapshot,
  previousSnapshot: ReachabilitySnapshot
) => void;

const listeners = new Set<ReachabilityListener>();

function areSnapshotsEqual(a: ReachabilitySnapshot, b: ReachabilitySnapshot): boolean {
  return a.appOnline === b.appOnline && a.mode === b.mode && a.runtimeState === b.runtimeState;
}

function emitSnapshotChange(next: ReachabilitySnapshot, previous: ReachabilitySnapshot): void {
  for (const listener of listeners) {
    listener(next, previous);
  }
}

export function setReachabilitySnapshot(next: ReachabilitySnapshot): void {
  const previousSnapshot = snapshot;

  if (areSnapshotsEqual(previousSnapshot, next)) {
    return;
  }

  snapshot = next;

  emitSnapshotChange(next, previousSnapshot);
}

export function resetReachabilitySnapshot(): void {
  setReachabilitySnapshot({ ...DEFAULT_REACHABILITY_SNAPSHOT });
}

export function getReachabilitySnapshot(): ReachabilitySnapshot {
  return snapshot;
}

export function subscribeToReachabilitySnapshot(listener: ReachabilityListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
