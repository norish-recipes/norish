"use client";

import type { ReactNode } from "react";
import { useSharePublicConfigQuery } from "@/hooks/recipes/use-share-public-config-query";
import { createStore } from "zustand";

import type { MeasurementSystem, PublicRecipeViewDTO } from "@norish/shared/contracts";
import { createPageStoreContext } from "@norish/shared-react/platform";
import { scaleIngredients, useSharedRecipeQuery } from "@norish/shared-react/recipes";

export type SharePageState = {
  token: string;
  /** The servings the reader picked; null shows the recipe's own. */
  servings: number | null;
  /** The measurement system the reader picked; null shows the one the recipe uses. */
  system: MeasurementSystem | null;
  setServings: (servings: number) => void;
  setSystem: (system: MeasurementSystem) => void;
};

export function createSharePageStore(token: string) {
  return createStore<SharePageState>()((set) => ({
    token,
    servings: null,
    system: null,
    setServings: (servings) => set({ servings }),
    setSystem: (system) => set({ system }),
  }));
}

const sharePage = createPageStoreContext("SharePageProvider", createSharePageStore);

/** Makes the shared recipe page's store; another token starts afresh. */
export function SharePageProvider({ token, children }: { token: string; children: ReactNode }) {
  return <sharePage.Provider pageKey={token}>{children}</sharePage.Provider>;
}

/** One slice of the shared recipe page's store; renders when that slice changes. */
export const useSharePageStore = sharePage.usePageStore;

/** The shared recipe, for the pieces drawn once it has loaded. */
export function useSharedRecipe(): PublicRecipeViewDTO {
  const token = useSharePageStore((state) => state.token);
  const { recipe } = useSharedRecipeQuery(token);

  if (!recipe) throw new Error("Shared recipe not loaded");

  return recipe;
}

export function useShareUnits() {
  const token = useSharePageStore((state) => state.token);

  return useSharePublicConfigQuery(token).units;
}

/** The servings the page shows: the reader's pick, else the recipe's own. */
export function useShareServings(): number {
  const picked = useSharePageStore((state) => state.servings);
  const recipe = useSharedRecipe();

  return picked ?? recipe.servings;
}

/** The measurement system the page shows: the reader's pick, else the recipe's. */
export function useShareSystem(): MeasurementSystem {
  const picked = useSharePageStore((state) => state.system);
  const recipe = useSharedRecipe();

  return picked ?? recipe.systemUsed;
}

/** The systems the recipe has lines in. */
export function useShareSystems(): MeasurementSystem[] {
  const recipe = useSharedRecipe();

  return Array.from(new Set(recipe.recipeIngredients.map((line) => line.systemUsed)));
}

/** The ingredients at the servings the page shows. */
export function useShareIngredients() {
  const recipe = useSharedRecipe();
  const servings = useShareServings();

  return scaleIngredients(recipe.recipeIngredients, recipe.servings, servings);
}
