"use client";

import type { ReactNode } from "react";
import { createContext, use, useState } from "react";
import { createStore, useStore } from "zustand";

import type { MeasurementSystem } from "@norish/shared/contracts";

/** A conversion the reader asked for, and the recipe version it was asked on. */
export type RecipeConversion = { target: MeasurementSystem; withAI: boolean; version: number };

export type RecipePageState = {
  recipeId: string;
  /** The servings the reader picked; null shows the recipe's own. */
  servings: number | null;
  /** The conversion on its way, until the recipe shows it. */
  conversion: RecipeConversion | null;
  /** Whether the reader asked to keep the screen awake. */
  wakeLock: boolean;
  setServings: (servings: number) => void;
  startConversion: (conversion: RecipeConversion) => void;
  /** Ends that conversion; a later one stays. */
  endConversion: (conversion: RecipeConversion) => void;
  /** A conversion that was rolled back drops the reader's servings with it. */
  conversionFailed: () => void;
  setWakeLock: (on: boolean) => void;
};

export type RecipePageStore = ReturnType<typeof createRecipePageStore>;

export function createRecipePageStore(recipeId: string) {
  return createStore<RecipePageState>()((set) => ({
    recipeId,
    servings: null,
    conversion: null,
    wakeLock: false,
    setServings: (servings) => set({ servings }),
    startConversion: (conversion) => set({ conversion }),
    endConversion: (conversion) =>
      set((state) => (state.conversion === conversion ? { conversion: null } : state)),
    conversionFailed: () => set({ conversion: null, servings: null }),
    setWakeLock: (wakeLock) => set({ wakeLock }),
  }));
}

const RecipePageContext = createContext<RecipePageStore | null>(null);

/**
 * Makes the recipe page's store. Per page, not module-level: on the server a
 * module-level store is one object every request shares.
 */
export function RecipePageProvider({
  recipeId,
  children,
}: {
  recipeId: string;
  children: ReactNode;
}) {
  const [store, setStore] = useState(() => createRecipePageStore(recipeId));

  // Another recipe in the same page starts afresh.
  if (store.getState().recipeId !== recipeId) setStore(createRecipePageStore(recipeId));

  return <RecipePageContext value={store}>{children}</RecipePageContext>;
}

export function useRecipePageStoreApi(): RecipePageStore {
  const store = use(RecipePageContext);

  if (!store) throw new Error("useRecipePageStore must be used within RecipePageProvider");

  return store;
}

/** One slice of the recipe page's store; renders when that slice changes. */
export function useRecipePageStore<T>(selector: (state: RecipePageState) => T): T {
  return useStore(useRecipePageStoreApi(), selector);
}
