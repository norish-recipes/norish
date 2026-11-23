/** A Settings write that checks Offline as it runs: a confirm accepted after the connection
 * dropped must not fire, as no Settings write enters the Outbox. */
export const guardWrite = (isOffline: () => boolean, write: () => void) => () => {
  if (!isOffline()) write();
};
