/** A Settings write that checks Offline as it runs: a confirm accepted after the connection
 * dropped must not fire, as no Settings write enters the Outbox. Hands back the write's result. */
export const guardWrite =
  <A extends unknown[], R>(isOffline: () => boolean, write: (...args: A) => R) =>
  (...args: A): R | undefined =>
    isOffline() ? undefined : write(...args);
