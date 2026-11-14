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

/**
 * The measurement conversion a recipe can offer, in one place: back to the
 * system it was written in, to the other one by the unit table and the
 * ingredient catalogue, and, where AI is on, to the other one by the language
 * model. Converting is a permission-gated action on the recipe and a Hidden
 * Item, so the gate has to answer the same way wherever the action is drawn.
 */
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

/**
 * Presses convert for the reader whose Preferences name a measurement system,
 * once per recipe opened: a recipe someone else switches while it is open
 * stays switched. With AI it writes only a copy that is missing; a copy already
 * there is switched to, as the unit table's would be. Only for a reader who
 * may convert the recipe, since anyone else would only be refused, and only
 * once the server's copy is in: a saved one may be behind, and a convert sent
 * from it is ignored as stale.
 */
export function useAutoConversion() {
  const recipeId = useRecipePageStore((state) => state.recipeId);
  const { recipe, isFetching } = useRecipeQuery(recipeId);
  const { convertingTo, startConversion } = useRecipeConversion();
  const { user } = useProfileQuery();
  const { canEditRecipe, isLoading } = useRecipePermissions();
  const isAIEnabled = usePermissions((p) => p.isAIEnabled);
  const choice = getMeasurementSystemPreference(user);
  const doneForRef = useRef<string | null>(null);

  useEffect(() => {
    const target = measurementSystemTarget(choice);

    if (!recipe || !target || isLoading || isFetching || convertingTo) return;
    if (doneForRef.current === recipe.id) return;
    if (recipe.recipeIngredients.length === 0) return;
    if (!ownerAllows(recipe.userId, canEditRecipe)) return;

    doneForRef.current = recipe.id;
    if (recipe.systemUsed === target.system) return;

    const hasCopy = recipe.recipeIngredients.some((line) => line.systemUsed === target.system);

    startConversion(target.system, target.withAI && isAIEnabled && !hasCopy);
  }, [
    recipe,
    choice,
    isLoading,
    isFetching,
    convertingTo,
    canEditRecipe,
    isAIEnabled,
    startConversion,
  ]);
}
