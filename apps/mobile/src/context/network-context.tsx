import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { useBackendHealthProbe } from "@/hooks/use-backend-health-probe";
import { getAuthTransportSnapshot, subscribeAuthTransport } from "@/lib/auth-session-sync";
import {
  resetReachabilitySnapshot,
  setReachabilitySnapshot,
} from "@/lib/network/reachability-store";
import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("network");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReachabilityMode = "offline" | "backend-unreachable" | "online";

type RuntimeState = "initializing" | "ready";

type NetworkStatusValue = {
  deviceOnline: boolean;
  backendReachable: boolean;
  appOnline: boolean;
  mode: ReachabilityMode;
  runtimeState: RuntimeState;
};

/** Interval (ms) between lightweight expo-network device-state polls. */
const DEVICE_POLL_INTERVAL_MS = 10_000;

// ---------------------------------------------------------------------------
// Module-level WebSocket connectivity signals
// ---------------------------------------------------------------------------

type BackendEventListener = () => void;

const disconnectListeners = new Set<BackendEventListener>();
const connectListeners = new Set<BackendEventListener>();

function subscribeBackendDisconnect(listener: BackendEventListener): () => void {
  disconnectListeners.add(listener);

  return () => {
    disconnectListeners.delete(listener);
  };
}

function subscribeBackendConnect(listener: BackendEventListener): () => void {
  connectListeners.add(listener);

  return () => {
    connectListeners.delete(listener);
  };
}

/**
 * Call this from outside React (e.g. a WebSocket close handler) to signal
 * that the backend connection was lost. The `NetworkProvider` will
 * immediately mark the backend as unreachable.
 */
export function notifyBackendDisconnect(): void {
  for (const listener of disconnectListeners) {
    listener();
  }
}

/**
 * Call this from outside React (e.g. a WebSocket open handler) to signal
 * that the backend is reachable. The `NetworkProvider` will immediately
 * mark the backend as reachable.
 */
export function notifyBackendConnect(): void {
  for (const listener of connectListeners) {
    listener();
  }
}

const NetworkContext = createContext<NetworkStatusValue | null>(null);

/**
 * Read the current reachability state.
 *
 * Must be called inside a `<NetworkProvider>`. Throws otherwise.
 */
export function useNetworkStatus(): NetworkStatusValue {
  const ctx = useContext(NetworkContext);

  if (!ctx) {
    throw new Error("useNetworkStatus must be used inside a <NetworkProvider>");
  }

  return ctx;
}

type NetworkProviderProps = {
  /** The configured backend base URL (null means no backend configured). */
  backendBaseUrl: string | null;
  children: React.ReactNode;
};

export function NetworkProvider({ backendBaseUrl, children }: NetworkProviderProps) {
  // ---- state ----
  const [deviceOnline, setDeviceOnline] = useState(true); // assume online until we know otherwise
  const [backendReachable, setBackendReachable] = useState(false);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("initializing");

  // ---- refs ----
  const isMountedRef = useRef(true);
  const authTransportSnapshot = useSyncExternalStore(
    subscribeAuthTransport,
    getAuthTransportSnapshot,
    getAuthTransportSnapshot
  );

  // -------------------------------------------------------------------
  // Device connectivity listener (expo-network)
  // -------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function checkDevice() {
      try {
        const state = await Network.getNetworkStateAsync();

        if (!cancelled) {
          setDeviceOnline(state.isInternetReachable ?? state.isConnected ?? false);
        }
      } catch {
        if (!cancelled) {
          setDeviceOnline(false);
        }
      }
    }

    void checkDevice();

    // expo-network does not have a subscription API on all platforms,
    // so we also listen for AppState changes to re-check.
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void checkDevice();
      }
    });

    // Poll device state on a lightweight interval to catch connectivity changes
    const poll = setInterval(() => {
      void checkDevice();
    }, DEVICE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(poll);
    };
  }, []);

  // -------------------------------------------------------------------
  // Settle runtime state once backend URL is known
  // -------------------------------------------------------------------
  useEffect(() => {
    // No async probe needed — just settle as ready.
    // Backend reachability is determined by HTTP health checks and WebSocket signals.
    setRuntimeState("ready");
  }, [backendBaseUrl]);

  // -------------------------------------------------------------------
  // Backend reachability probe (HTTP)
  // -------------------------------------------------------------------
  const markReachable = useCallback(() => setBackendReachable(true), []);
  const markUnreachable = useCallback(() => setBackendReachable(false), []);

  useBackendHealthProbe({
    backendBaseUrl,
    deviceOnline,
    hasActiveSession: authTransportSnapshot.hasActiveSession,
    onReachable: markReachable,
    onUnreachable: markUnreachable,
  });

  // -------------------------------------------------------------------
  // When device transitions offline, mark backend unreachable immediately
  // -------------------------------------------------------------------
  const prevDeviceOnlineRef = useRef(deviceOnline);

  useEffect(() => {
    const wasOffline = !prevDeviceOnlineRef.current;

    prevDeviceOnlineRef.current = deviceOnline;

    if (wasOffline && deviceOnline) {
      log.info("Device connectivity restored — waiting for WebSocket to reconnect");
    }

    if (!deviceOnline) {
      // If device goes offline, mark backend unreachable immediately
      setBackendReachable(false);
    }
  }, [deviceOnline]);

  // -------------------------------------------------------------------
  // React to WebSocket connect signal
  // -------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = subscribeBackendConnect(() => {
      if (!isMountedRef.current) {
        return;
      }

      setBackendReachable(true);
      log.info("WebSocket connected — backend marked reachable");
    });

    return unsubscribe;
  }, []);

  // -------------------------------------------------------------------
  // React to WebSocket disconnect signal
  // -------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = subscribeBackendDisconnect(() => {
      if (!isMountedRef.current) {
        return;
      }

      setBackendReachable(false);
      log.info("WebSocket disconnected — backend marked unreachable");
    });

    return unsubscribe;
  }, []);

  // -------------------------------------------------------------------
  // Wire TanStack Query onlineManager
  // -------------------------------------------------------------------
  const appOnline = deviceOnline && backendReachable;

  useEffect(() => {
    onlineManager.setOnline(deviceOnline);

    return onlineManager.setEventListener((setOnline) => {
      // React Query should pause only when the device is offline.
      // Backend reachability is tracked separately because HTTP queries may
      // still be needed before any WebSocket connection exists.
      setOnline(deviceOnline);

      return () => {};
    });
  }, [deviceOnline]);

  // -------------------------------------------------------------------
  // Derive mode
  // -------------------------------------------------------------------
  const mode: ReachabilityMode = !deviceOnline
    ? "offline"
    : !backendReachable
      ? "backend-unreachable"
      : "online";

  // Log mode transitions
  const prevModeRef = useRef(mode);

  useEffect(() => {
    if (prevModeRef.current !== mode) {
      log.info(`Reachability mode: ${prevModeRef.current} → ${mode}`);
      prevModeRef.current = mode;
    }
  }, [mode]);

  // -------------------------------------------------------------------
  // Keep non-React reachability consumers in sync
  // -------------------------------------------------------------------
  useEffect(() => {
    setReachabilitySnapshot({ appOnline, mode, runtimeState });
  }, [appOnline, mode, runtimeState]);

  // -------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      resetReachabilitySnapshot();
    };
  }, []);

  const value = useMemo<NetworkStatusValue>(
    () => ({
      deviceOnline,
      backendReachable,
      appOnline,
      mode,
      runtimeState,
    }),
    [appOnline, backendReachable, deviceOnline, mode, runtimeState]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}
