/**
 * Single-leader coordination via the Web Locks API.
 *
 * Replay (inside Recovery) runs in one tab at a time so
 * two tabs can't drain the shared Outbox at once. The lock is taken
 * *exclusive and blocking*: a second tab's call waits until the holder releases,
 * which means every tab's reconnect flow observes the drain as finished before
 * it refetches — preserving drain-before-refetch ordering across tabs, not just
 * within one.
 *
 * Where the Web Locks API is unavailable the task simply runs directly; the
 * server-side idempotency middleware keeps a doubled replay safe regardless.
 */

export const OUTBOX_LEADER_LOCK = "norish-outbox-replay";

type LockGrantedCallback<T> = () => Promise<T>;

interface LockManagerLike {
  request<T>(
    name: string,
    options: { mode: "exclusive" | "shared"; ifAvailable?: boolean },
    callback: (lock: unknown) => Promise<T>
  ): Promise<T>;
}

function getLockManager(): LockManagerLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;

  return locks ?? null;
}

/**
 * Run `task` while holding the Outbox leader lock, resolving with its result.
 * Blocks until the lock is free, so callers can rely on any prior holder's work
 * (a drain) having completed once this resolves.
 */
export async function runWithOutboxLock<T>(
  task: LockGrantedCallback<T>,
  lockName: string = OUTBOX_LEADER_LOCK
): Promise<T> {
  const locks = getLockManager();

  if (!locks) {
    return task();
  }

  return locks.request(lockName, { mode: "exclusive" }, task);
}

/**
 * Run `task` only if this tab can take the leader lock right now; otherwise skip
 * (another tab is leading). Used for the Cache Warmer, which the ADR scopes to a
 * single leader tab: unlike a drain, a skipped warm needs no catch-up — the
 * leader warms and persists, and other tabs pick it up from the shared cache.
 *
 * Resolves with the task's result, or `undefined` when it was skipped. Where the
 * Web Locks API is unavailable the task simply runs (idempotent prefetch is cheap).
 */
export async function runIfLeader<T>(
  task: LockGrantedCallback<T>,
  lockName: string = OUTBOX_LEADER_LOCK
): Promise<T | undefined> {
  const locks = getLockManager();

  if (!locks) {
    return task();
  }

  return locks.request(lockName, { mode: "exclusive", ifAvailable: true }, (lock) =>
    lock ? task() : Promise.resolve(undefined)
  );
}
