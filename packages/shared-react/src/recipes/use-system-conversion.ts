import { useEffect, useRef } from "react";

import type { MeasurementSystem } from "@norish/shared/contracts";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";
import {
  getMeasurementSystemPreference,
  measurementSystemTarget,
} from "@norish/shared/lib/user-preferences";

import {
  ownerAllows,
  useHiddenItemVisibility,
  usePermissions,
  usePreferencesSaving,
  useProfileQuery,
  useRecipePermissions,
} from "../reader";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useRecipePageStore, useRecipePageStoreApi } from "./recipe-page-store";
import { useLoadedPageRecipe, useRecipeConversion } from "./use-recipe-page";
import { useRecipeQuery } from "./use-recipe-query";

/** The `recipes.convert` message each option is written with. */
export type SystemConversionLabelKey = "toMetric" | "toUS" | "toMetricWithAI" | "toUSWithAI";

export type SystemConversionOption = {
  key: string;
  system: MeasurementSystem;
  labelKey: SystemConversionLabelKey;
  /** The language model writes the copy in this system again. */
  withAI: boolean;
  /** The system the recipe was written in. */
  isOriginal: boolean;
};

type SystemConversion = {
  /** Whether there is a conversion worth offering this reader at all. */
  isAvailable: boolean;
  options: SystemConversionOption[];
  currentSystem: MeasurementSystem;
  isConverting: boolean;
  convertTo: (option: SystemConversionOption) => void;
};

/** The conversions a recipe offers: back to its own system, to the other by the unit table and
 * catalogue, or by AI where on; one gate for the permission and the Hidden Item everywhere. */
export function useSystemConversion(): SystemConversion {
  const recipe = useLoadedPageRecipe();
  const { convertingTo, startConversion } = useRecipeConversion();
  const { showConversion } = useHiddenItemVisibility();
  const isAIEnabled = usePermissions((p) => p.isAIEnabled);

  const original = recipe.originalSystem ?? recipe.systemUsed;
  const other: MeasurementSystem = original === "metric" ? "us" : "metric";
  const labelKey = (system: MeasurementSystem): SystemConversionLabelKey =>
    system === "metric" ? "toMetric" : "toUS";
  const options: SystemConversionOption[] = [
    {
      key: original,
      system: original,
      labelKey: labelKey(original),
      withAI: false,
      isOriginal: true,
    },
    { key: other, system: other, labelKey: labelKey(other), withAI: false, isOriginal: false },
  ];

  if (isAIEnabled) {
    options.push({
      key: `${other}-ai`,
      system: other,
      labelKey: other === "metric" ? "toMetricWithAI" : "toUSWithAI",
      withAI: true,
      isOriginal: false,
    });
  }

  const currentSystem: MeasurementSystem = convertingTo != null ? convertingTo : recipe.systemUsed;

  return {
    // A recipe with no lines has nothing to convert.
    isAvailable: showConversion && recipe.recipeIngredients.length > 0,
    options,
    currentSystem,
    isConverting: convertingTo != null,
    convertTo: (option) => {
      if (!option.withAI && option.system === currentSystem) return;

      startConversion(option.system, option.withAI, true);
    },
  };
}

/** Converts once per recipe and confirmed choice (Off included), on the server's copy, with AI only
 * for a missing copy; a pick by hand the server applied counts as acting on the next choice. */
export function useAutoConversion() {
  const saving = usePreferencesSaving();
  const recipeId = useRecipePageStore((state) => state.recipeId);
  const { recipe, isFetching } = useRecipeQuery(recipeId);
  const { convertingTo, startConversion } = useRecipeConversion();
  const { user } = useProfileQuery();
  const { canEditRecipe, isLoading } = useRecipePermissions();
  const isAIEnabled = usePermissions((p) => p.isAIEnabled);
  const choice = getMeasurementSystemPreference(user);
  const doneForRef = useRef<string | null>(null);
  // Whether the pick by hand that just ended was the server's own result, not a stale one.
  const confirmedRef = useRef(false);
  const store = useRecipePageStoreApi();
  const manual = useRecipePageStore((state) => state.manualConversion);
  const trpc = useTRPC();

  // A pick by hand is settled by its own conversion's result alone.
  useRealtimeSubscription<PayloadOf<RecipesRealtime, "converted">>(trpc.recipes.onConverted, {
    onEvent: ({ recipe: settled, conversion, stale }) => {
      const page = store.getState();
      const asked = page.manualConversion;

      if (
        settled.id !== recipeId ||
        !asked ||
        asked.target !== conversion.target ||
        asked.withAI !== conversion.withAI ||
        asked.version !== conversion.version
      )
        return;
      confirmedRef.current = !stale;
      page.endManualConversion();
    },
  });

  // A failed conversion is announced, not answered: it ends the one on its way.
  useRealtimeSubscription<PayloadOf<RecipesRealtime, "failed">>(trpc.recipes.onFailed, {
    onEvent: ({ recipeId: failed }) => {
      const page = store.getState();

      if (failed === recipeId && (page.conversion || page.manualConversion))
        page.conversionFailed();
    },
  });

  useEffect(() => {
    if (convertingTo || !recipe || isLoading || isFetching || saving) return;
    const target = measurementSystemTarget(choice);
    const doneFor = `${recipe.id}:${choice}`;

    // A pick by hand the server applied stands; one it found stale does not.
    if (manual) return;
    if (confirmedRef.current) {
      confirmedRef.current = false;
      doneForRef.current = doneFor;

      return;
    }
    if (doneForRef.current === doneFor) return;
    if (!target) {
      doneForRef.current = doneFor;

      return;
    }
    if (recipe.recipeIngredients.length === 0) return;
    if (!ownerAllows(recipe.userId, canEditRecipe)) return;

    doneForRef.current = doneFor;
    if (recipe.systemUsed === target.system) return;

    const hasCopy = recipe.recipeIngredients.some((line) => line.systemUsed === target.system);

    startConversion(target.system, target.withAI && isAIEnabled && !hasCopy);
  }, [
    recipe,
    choice,
    saving,
    isLoading,
    isFetching,
    convertingTo,
    manual,
    store,
    canEditRecipe,
    isAIEnabled,
    startConversion,
  ]);
}
