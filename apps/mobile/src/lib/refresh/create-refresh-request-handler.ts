export type RefreshHandler = () => Promise<void>;

export function createRefreshRequestHandler(task: () => Promise<void> | void): RefreshHandler {
  let inFlight: Promise<void> | null = null;

  return () => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = Promise.resolve(task()).finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}
