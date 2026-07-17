"use client";

import { useSyncExternalStore } from "react";

export type WebConnectivityState = "checking" | "online" | "offline" | "backend-unreachable";

export type WebConnectivitySnapshot = {
  state: WebConnectivityState;
  lastOutcomeAt: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  simulatedBackendUnavailable: boolean;
  recoveryInProgress: boolean;
};

export const WEB_CONNECTIVITY_RECOVERED_EVENT = "norish:web-connectivity-recovered";
export const WEB_BACKEND_SIMULATION_STORAGE_KEY = "norish-web-simulate-backend-unavailable";

type RecoveryCheck = () => Promise<boolean>;
type RuntimeEnvironment = "development" | "production" | "test" | undefined;

const SERVER_CONNECTIVITY_SNAPSHOT: WebConnectivitySnapshot = {
  state: "checking",
  lastOutcomeAt: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  simulatedBackendUnavailable: false,
  recoveryInProgress: false,
};

function canSimulate(environment: RuntimeEnvironment): boolean {
  return environment === "development";
}

export function readBackendUnavailableSimulation(
  storage: Pick<Storage, "getItem"> | null,
  environment: RuntimeEnvironment
): boolean {
  if (!canSimulate(environment) || !storage) return false;

  try {
    return storage.getItem(WEB_BACKEND_SIMULATION_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export class WebConnectivityRuntime {
  private listeners = new Set<() => void>();
  private recoveryCheck: RecoveryCheck | null = null;
  private recoveryPromise: Promise<boolean> | null = null;
  private browserListenersStarted = false;
  private snapshot: WebConnectivitySnapshot;

  constructor(
    private readonly environment: RuntimeEnvironment,
    private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = null
  ) {
    this.snapshot = {
      state: "checking",
      lastOutcomeAt: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      simulatedBackendUnavailable: readBackendUnavailableSimulation(storage, environment),
      recoveryInProgress: false,
    };

    if (this.snapshot.simulatedBackendUnavailable) {
      this.snapshot = {
        ...this.snapshot,
        state: "backend-unreachable",
        lastOutcomeAt: this.nextOutcomeAt(),
        lastFailureAt: this.nextOutcomeAt(),
      };
    }
  }

  getSnapshot = (): WebConnectivitySnapshot => this.snapshot;

  getServerSnapshot = (): WebConnectivitySnapshot => SERVER_CONNECTIVITY_SNAPSHOT;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  };

  start(recoveryCheck: RecoveryCheck): () => void {
    this.recoveryCheck = recoveryCheck;

    if (typeof window === "undefined" || this.browserListenersStarted) {
      return () => undefined;
    }

    this.browserListenersStarted = true;

    const onOffline = () => this.reportBrowserOffline();
    const onOnline = () => void this.recover();

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    if (!navigator.onLine) this.reportBrowserOffline();

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      this.browserListenersStarted = false;
      this.recoveryCheck = null;
    };
  }

  isDegraded(): boolean {
    return this.snapshot.state === "offline" || this.snapshot.state === "backend-unreachable";
  }

  reportBrowserOffline(): void {
    this.commitFailure("offline");
  }

  reportHttpSuccess(): void {
    if (this.snapshot.simulatedBackendUnavailable) return;

    const recovered = this.isDegraded();
    const outcomeAt = this.nextOutcomeAt();

    this.commit({
      ...this.snapshot,
      state: "online",
      lastOutcomeAt: outcomeAt,
      lastSuccessAt: outcomeAt,
    });

    if (recovered && typeof window !== "undefined") {
      window.dispatchEvent(new Event(WEB_CONNECTIVITY_RECOVERED_EVENT));
    }
  }

  reportHttpFailure(): void {
    const state =
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "offline"
        : "backend-unreachable";

    this.commitFailure(state);
  }

  async recover(): Promise<boolean> {
    if (this.recoveryPromise) return this.recoveryPromise;

    if (this.snapshot.simulatedBackendUnavailable || !this.recoveryCheck) {
      this.reportHttpFailure();

      return false;
    }

    this.commit({ ...this.snapshot, recoveryInProgress: true });
    const wasDegraded = this.isDegraded();
    this.recoveryPromise = this.recoveryCheck()
      .then((succeeded) => {
        if (!succeeded) {
          this.reportHttpFailure();

          return false;
        }

        this.reportHttpSuccess();
        if (!wasDegraded && typeof window !== "undefined") {
          window.dispatchEvent(new Event(WEB_CONNECTIVITY_RECOVERED_EVENT));
        }

        return true;
      })
      .catch(() => {
        this.reportHttpFailure();

        return false;
      })
      .finally(() => {
        this.recoveryPromise = null;
        this.commit({ ...this.snapshot, recoveryInProgress: false });
      });

    return this.recoveryPromise;
  }

  async setSimulatedBackendUnavailable(enabled: boolean): Promise<boolean> {
    if (!canSimulate(this.environment)) return false;

    if (enabled) {
      try {
        this.storage?.setItem(WEB_BACKEND_SIMULATION_STORAGE_KEY, "true");
      } catch {
        // The simulation remains useful for the current tab when storage is unavailable.
      }
      this.commit({ ...this.snapshot, simulatedBackendUnavailable: true });
      this.reportHttpFailure();

      return true;
    }

    this.commit({ ...this.snapshot, simulatedBackendUnavailable: false });
    const recovered = await this.recover();

    if (!recovered) {
      try {
        this.storage?.setItem(WEB_BACKEND_SIMULATION_STORAGE_KEY, "true");
      } catch {
        // Keep the override enabled in this tab when persistence is unavailable.
      }
      this.commit({ ...this.snapshot, simulatedBackendUnavailable: true });

      return false;
    }

    try {
      this.storage?.removeItem(WEB_BACKEND_SIMULATION_STORAGE_KEY);
    } catch {
      // The successful live check still safely disables simulation in this tab.
    }

    return true;
  }

  private commitFailure(state: "offline" | "backend-unreachable"): void {
    const outcomeAt = this.nextOutcomeAt();

    this.commit({
      ...this.snapshot,
      state,
      lastOutcomeAt: outcomeAt,
      lastFailureAt: outcomeAt,
    });
  }

  private nextOutcomeAt(): number {
    return Math.max(Date.now(), this.snapshot.lastOutcomeAt + 1);
  }

  private commit(next: WebConnectivitySnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// This explicit reference is statically replaced by Next.js in production builds.
// eslint-disable-next-line no-restricted-properties
const environment = process.env.NODE_ENV;

export const webConnectivityRuntime = new WebConnectivityRuntime(environment, getBrowserStorage());

export function useWebConnectivity(): WebConnectivitySnapshot {
  return useWebConnectivityRuntime(webConnectivityRuntime);
}

export function useWebConnectivityRuntime(
  runtime: WebConnectivityRuntime
): WebConnectivitySnapshot {
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getServerSnapshot);
}
