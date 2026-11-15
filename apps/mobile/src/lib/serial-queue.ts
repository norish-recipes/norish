/** Runs each task after the ones queued before it; a failure goes to `onError`, never stopping the next. */
export function serialQueue(onError: (error: unknown) => void) {
  let chain = Promise.resolve();

  return {
    run: (task: () => Promise<void>): Promise<void> => (chain = chain.then(task).catch(onError)),
    /** Later tasks stop waiting for the ones queued so far. */
    reset: () => void (chain = Promise.resolve()),
  };
}
