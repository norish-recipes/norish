type RecoveryListener = () => void;

export class WebRecoveryCoordinator {
  private readonly replaySettledListeners = new Set<RecoveryListener>();
  private readonly succeededListeners = new Set<RecoveryListener>();

  notifyReplaySettled = (): void => {
    for (const listener of this.replaySettledListeners) listener();
  };

  notifySucceeded = (): void => {
    for (const listener of this.succeededListeners) listener();
  };

  subscribeToReplaySettled = (listener: RecoveryListener): (() => void) => {
    this.replaySettledListeners.add(listener);

    return () => this.replaySettledListeners.delete(listener);
  };

  subscribeToSucceeded = (listener: RecoveryListener): (() => void) => {
    this.succeededListeners.add(listener);

    return () => this.succeededListeners.delete(listener);
  };
}

const browserRecoveryGlobal = globalThis as typeof globalThis & {
  __norishWebRecoveryCoordinator?: WebRecoveryCoordinator;
};

export const webRecoveryCoordinator =
  typeof window === "undefined"
    ? new WebRecoveryCoordinator()
    : (browserRecoveryGlobal.__norishWebRecoveryCoordinator ??= new WebRecoveryCoordinator());
