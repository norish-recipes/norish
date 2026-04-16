"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("ConnectionMonitor");

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

type ConnectionMonitorContextValue = {
  status: ConnectionStatus;
  isConnected: boolean;
  isReconnecting: boolean;
  onReconnect: (callback: () => void) => () => void;
  setStatus: (status: ConnectionStatus) => void;
};

const ConnectionMonitorContext = createContext<ConnectionMonitorContextValue | null>(null);

export function ConnectionMonitorProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<ConnectionStatus>("connecting");
  const previousStatusRef = useRef<ConnectionStatus>("connecting");
  const reconnectCallbacksRef = useRef<Set<() => void>>(new Set());

  const setStatus = useCallback((newStatus: ConnectionStatus) => {
    const previousStatus = previousStatusRef.current;

    previousStatusRef.current = newStatus;
    setStatusState(newStatus);

    if (newStatus === "connected" && previousStatus !== "connected") {
      log.info("Connection restored, invalidating caches...");
      reconnectCallbacksRef.current.forEach((callback) => {
        try {
          callback();
        } catch (err) {
          log.error({ err }, "Error in reconnect callback");
        }
      });
    }
  }, []);

  const onReconnect = useCallback((callback: () => void) => {
    reconnectCallbacksRef.current.add(callback);

    return () => {
      reconnectCallbacksRef.current.delete(callback);
    };
  }, []);

  const value: ConnectionMonitorContextValue = {
    status,
    isConnected: status === "connected",
    isReconnecting: status === "connecting" && previousStatusRef.current === "disconnected",
    onReconnect,
    setStatus,
  };

  return (
    <ConnectionMonitorContext.Provider value={value}>{children}</ConnectionMonitorContext.Provider>
  );
}

export function useConnectionMonitor() {
  const context = useContext(ConnectionMonitorContext);

  if (!context) {
    throw new Error("useConnectionMonitor must be used within a ConnectionMonitorProvider");
  }

  return context;
}
