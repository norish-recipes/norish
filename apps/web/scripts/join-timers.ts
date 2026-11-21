/**
 * Runs in the page: timers of one delay set within `windowMs` of the first fire in its task, so
 * React batches their updates on every run instead of when the browser happens to.
 */
export function joinTimers(windowMs: number) {
  const { setTimeout: nativeSet, clearTimeout: nativeClear } = globalThis;

  type Group = {
    ms: number;
    since: number;
    runs: Map<number, () => void>;
    native: ReturnType<typeof nativeSet>;
  };
  // The newest group of each delay that has not fired yet.
  const open = new Map<number, Group>();
  const groupOf = new Map<number, Group>();
  let nextId = 2 ** 30;

  globalThis.setTimeout = ((handler: TimerHandler, ms = 0, ...args: unknown[]) => {
    // A zero delay asks for the next task, which is the browser's to order.
    if (typeof handler !== "function" || ms <= 0) return nativeSet(handler, ms, ...args);
    let group = open.get(ms);

    if (!group || performance.now() - group.since > windowMs) {
      const created: Group = {
        ms,
        since: performance.now(),
        runs: new Map(),
        native: nativeSet(() => {
          if (open.get(ms) === created) open.delete(ms);
          for (const [id, run] of created.runs) {
            groupOf.delete(id);
            try {
              run();
            } catch (error) {
              reportError(error);
            }
          }
        }, ms),
      };

      group = created;
      open.set(ms, created);
    }
    const id = nextId++;

    group.runs.set(id, () => handler(...args));
    groupOf.set(id, group);

    return id;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: number) => {
    const group = groupOf.get(id);

    if (!group) return nativeClear(id);
    groupOf.delete(id);
    group.runs.delete(id);
    if (group.runs.size > 0) return;
    nativeClear(group.native);
    if (open.get(group.ms) === group) open.delete(group.ms);
  }) as typeof clearTimeout;
}
