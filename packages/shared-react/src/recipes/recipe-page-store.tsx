"use client";

import type { ReactNode } from "react";
import { createStore } from "zustand";

import type { MeasurementSystem } from "@norish/shared/contracts";

import { createPageStoreContext } from "../page-store";

/** A conversion the reader asked for, and the recipe version it was asked on. */
type RecipeConversion = { target: MeasurementSystem; withAI: boolean; version: number };

export type RecipePageState = {
  recipeId: string;
  /** The servings the reader picked; null shows the recipe's own. */
  servings: number | null;
  /** The conversion on its way, until the recipe shows it. */
  conversion: RecipeConversion | null;
  /** The screen wake lock: off, asked for by the reader, or held once the browser grants it. */
  wakeLock: "off" | "asked" | "held";
  setServings: (servings: number) => void;
  startConversion: (conversion: RecipeConversion) => void;
  /** Ends that conversion; a later one stays. */
  endConversion: (conversion: RecipeConversion) => void;
  /** A conversion that was rolled back drops the reader's servings with it. */
  conversionFailed: () => void;
  setWakeLock: (wakeLock: RecipePageState["wakeLock"]) => void;
};

export function createRecipePageStore(recipeId: string) {
  return createStore<RecipePageState>()((set) => ({
    recipeId,
    servings: null,
    conversion: null,
    wakeLock: "off",
    setServings: (servings) => set({ servings }),
    startConversion: (conversion) => set({ conversion }),
    endConversion: (conversion) =>
      set((state) => (state.conversion === conversion ? { conversion: null } : state)),
    conversionFailed: () => set({ conversion: null, servings: null }),
    setWakeLock: (wakeLock) => set({ wakeLock }),
  }));
}

const recipePage = createPageStoreContext("RecipePageProvider", createRecipePageStore);

/** Makes the recipe page's store; another recipe in the same page starts afresh. */
export function RecipePageProvider({
  recipeId,
  children,
}: {
  recipeId: string;
  children: ReactNode;
}) {
  return <recipePage.Provider pageKey={recipeId}>{children}</recipePage.Provider>;
}

export const useRecipePageStoreApi = recipePage.usePageStoreApi;

/** One slice of the recipe page's store; renders when that slice changes. */
export const useRecipePageStore = recipePage.usePageStore;
