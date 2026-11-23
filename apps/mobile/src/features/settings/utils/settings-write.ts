/** A Settings write that checks Offline as it runs: a confirm accepted after the connection
 * dropped must not fire, as no Settings write enters the Outbox. Hands back the write's result. */
export const guardWrite =
  <A extends unknown[], R>(isOffline: () => boolean, write: (...args: A) => R) =>
  (...args: A): R | undefined =>
    isOffline() ? undefined : write(...args);

const inFlight = new Set<string>();

/** Drops a repeat of the write `key` names while it is in flight, handing back undefined for it.
 * The key is taken before the write starts and freed however it ends. */
export const guardRepeat =
  <A extends unknown[], R>(key: string, write: (...args: A) => R) =>
  async (...args: A): Promise<Awaited<R> | undefined> => {
    if (inFlight.has(key)) return undefined;

    inFlight.add(key);

    try {
      return await write(...args);
    } finally {
      inFlight.delete(key);
    }
  };
