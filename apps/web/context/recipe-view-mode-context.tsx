"use client";

import type { RecipeDashboardViewMode } from "@/lib/recipe-view-mode";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { readRecipeViewModeCookie, writeRecipeViewModeCookie } from "@/lib/recipe-view-mode";
import { useIsomorphicLayoutEffect } from "usehooks-ts";

type RecipeViewModeValue = readonly [
  RecipeDashboardViewMode,
  (viewMode: RecipeDashboardViewMode) => void,
];

const RecipeViewModeContext = createContext<RecipeViewModeValue | null>(null);

export function RecipeViewModeProvider({
  children,
  initialViewMode,
}: {
  children: ReactNode;
  initialViewMode?: RecipeDashboardViewMode;
}) {
  // `initialViewMode` is the cookie as the server read it, so the markup this
  // hydrates into already carries the right layout. Without it — the offline
  // bootstrap mounts the dashboard client-side, well after hydration — the
  // cookie is readable here instead, still before the first paint.
  const [viewMode, setViewMode] = useState<RecipeDashboardViewMode>(
    () => initialViewMode ?? readRecipeViewModeCookie() ?? "grid"
  );

  // The document is not guaranteed to be fresh: the service worker can answer a
  // navigation from its HTML cache (ADR-0013) with a copy that predates the last
  // toggle. Reconciling in a layout effect keeps the cookie authoritative and is
  // a no-op on every load that came from the network.
  useIsomorphicLayoutEffect(() => {
    const stored = readRecipeViewModeCookie();

    if (stored) setViewMode(stored);
  }, []);

  const selectViewMode = useCallback((next: RecipeDashboardViewMode) => {
    writeRecipeViewModeCookie(next);
    setViewMode(next);
  }, []);

  const value = useMemo<RecipeViewModeValue>(
    () => [viewMode, selectViewMode],
    [viewMode, selectViewMode]
  );

  return <RecipeViewModeContext.Provider value={value}>{children}</RecipeViewModeContext.Provider>;
}

export function useRecipeDashboardViewMode(): RecipeViewModeValue {
  const context = useContext(RecipeViewModeContext);

  if (!context) {
    throw new Error("useRecipeDashboardViewMode must be used within a RecipeViewModeProvider");
  }

  return context;
}
