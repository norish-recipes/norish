/** Resolves once a write settles; its `onError` already told the reader, the caller only waits to go on. */
export const settled = (write: Promise<unknown>): Promise<void> =>
  write.then(
    () => undefined,
    () => undefined
  );
