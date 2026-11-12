/** Resolves once a write settles; its `onError` already told the reader, the caller only waits to go on. */
export const settled = (write: Promise<unknown>): Promise<void> =>
  write.then(
    () => undefined,
    () => undefined
  );

/** Resolves whether a write went through; its `onError` already told the reader why not. */
export const wentThrough = (write: Promise<unknown>): Promise<boolean> =>
  write.then(
    () => true,
    () => false
  );

/** Resolves a write's answer, or null when it failed; its `onError` already told the reader why. */
export const answered = <T>(write: Promise<T>): Promise<T | null> =>
  write.then(
    (answer) => answer,
    () => null
  );
