import type { AppearanceMode } from "@/lib/preferences/appearance-preference-store";
import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  loadAppearanceMode,
  saveAppearanceMode,
} from "@/lib/preferences/appearance-preference-store";
import { Uniwind } from "uniwind";

import { createClientLogger } from "@norish/shared/lib/logger";

export type { AppearanceMode };

type AppearanceSnapshot = {
  mode: AppearanceMode;
  hydrated: boolean;
};

const log = createClientLogger("appearance-preference");

const listeners = new Set<() => void>();

let snapshot: AppearanceSnapshot = {
  mode: "system",
  hydrated: false,
};
let initPromise: Promise<void> | null = null;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AppearanceSnapshot {
  return snapshot;
}

function applyAppearanceMode(mode: AppearanceMode) {
  if (mode === "system") {
    Uniwind.setTheme("system");
    return;
  }

  Uniwind.setTheme(mode);
}

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      // The appearance preference gates the whole app boot, so it always has to
      // settle: falling back to "system" is a cosmetic loss, never rendering is
      // not. See the boot gate in `src/app/_layout.tsx`.
      let nextMode: AppearanceMode = "system";

      try {
        nextMode = await loadAppearanceMode();
        applyAppearanceMode(nextMode);
      } catch (error) {
        log.warn({ error }, "Could not restore the appearance preference, using system");
      } finally {
        snapshot = {
          mode: nextMode,
          hydrated: true,
        };
        emit();
      }
    })();
  }

  await initPromise;
}

function setAppearanceMode(nextMode: AppearanceMode) {
  snapshot = {
    ...snapshot,
    mode: nextMode,
  };
  applyAppearanceMode(nextMode);
  saveAppearanceMode(nextMode);
  emit();
}

export function AppearancePreferenceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void ensureInitialized();
  }, []);

  return <>{children}</>;
}

export function useAppearancePreference() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void ensureInitialized();
  }, []);

  const setMode = useCallback((nextMode: AppearanceMode) => {
    setAppearanceMode(nextMode);
  }, []);

  return {
    mode: snapshot.mode,
    hydrated: snapshot.hydrated,
    setMode,
  };
}
