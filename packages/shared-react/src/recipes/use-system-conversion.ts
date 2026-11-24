import { useEffect, useRef } from "react";

import type { MeasurementSystem } from "@norish/shared/contracts";
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
import { useRecipePageStore } from "./recipe-page-store";
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

      startConversion(option.system, option.withAI);
    },
  };
}

/** Converts once per recipe and confirmed choice (Off included), on the server's copy, with AI only
 * for a missing copy; a pick by hand counts as acting on the choice confirmed next, so it stands. */
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
  const startedRef = useRef(false);
  const byHandRef = useRef(false);

  useEffect(() => {
    // A conversion this hook did not start was picked by hand.
    if (convertingTo) {
      if (!startedRef.current) byHandRef.current = true;

      return;
    }
    startedRef.current = false;
    if (!recipe || isLoading || isFetching || saving) return;
    const target = measurementSystemTarget(choice);
    const doneFor = `${recipe.id}:${choice}`;

    if (byHandRef.current) {
      byHandRef.current = false;
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

    startedRef.current = true;
    startConversion(target.system, target.withAI && isAIEnabled && !hasCopy);
  }, [
    recipe,
    choice,
    saving,
    isLoading,
    isFetching,
    convertingTo,
    canEditRecipe,
    isAIEnabled,
    startConversion,
  ]);
}
