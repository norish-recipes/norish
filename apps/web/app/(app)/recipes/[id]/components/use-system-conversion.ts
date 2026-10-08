"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePermissionsContext } from "@/context/permissions-context";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { useUserSettingsQuery } from "@/hooks/user/use-user-query";
import { useTranslations } from "next-intl";

import type { MeasurementSystem } from "@norish/shared/contracts";
import {
  getMeasurementSystemPreference,
  measurementSystemTarget,
} from "@norish/shared/lib/user-preferences";

import { useRecipeContext, useRecipeContextRequired } from "../context";

export type SystemConversionOption = {
  key: string;
  system: MeasurementSystem;
  label: string;
  /** The language model writes the copy in this system again. */
  withAI: boolean;
  /** The system the recipe was written in. */
  isOriginal: boolean;
};

export type SystemConversion = {
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
 * Item, so the gate has to answer the same way wherever the action is drawn —
 * the mobile actions menu and the desktop control read it from here rather
 * than each deciding for themselves.
 */
export function useSystemConversion(): SystemConversion {
  const { recipe, convertingTo, startConversion } = useRecipeContextRequired();
  const { showConversion } = useHiddenItemVisibility();
  const { isAIEnabled } = usePermissionsContext();
  const t = useTranslations("recipes.convert");

  const original = recipe.originalSystem ?? recipe.systemUsed;

  const options = useMemo(() => {
    const other: MeasurementSystem = original === "metric" ? "us" : "metric";
    const label = (system: MeasurementSystem) => (system === "metric" ? t("toMetric") : t("toUS"));
    const built: SystemConversionOption[] = [
      { key: original, system: original, label: label(original), withAI: false, isOriginal: true },
      { key: other, system: other, label: label(other), withAI: false, isOriginal: false },
    ];

    if (isAIEnabled) {
      built.push({
        key: `${other}-ai`,
        system: other,
        label: other === "metric" ? t("toMetricWithAI") : t("toUSWithAI"),
        withAI: true,
        isOriginal: false,
      });
    }

    return built;
  }, [original, isAIEnabled, t]);

  const currentSystem: MeasurementSystem = convertingTo != null ? convertingTo : recipe.systemUsed;

  return {
    // A recipe with no lines has nothing to convert.
    isAvailable: showConversion && recipe.recipeIngredients.length > 0,
    options,
    currentSystem,
    isConverting: convertingTo != null,
    convertTo: (option: SystemConversionOption) => {
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
  const { recipe, isFetching, convertingTo, startConversion } = useRecipeContext();
  const { user } = useUserSettingsQuery();
  const { canEditRecipe, isAIEnabled, isLoading } = usePermissionsContext();
  const choice = getMeasurementSystemPreference(user);
  const doneForRef = useRef<string | null>(null);

  useEffect(() => {
    const target = measurementSystemTarget(choice);

    if (!recipe || !target || isLoading || isFetching || convertingTo) return;
    if (doneForRef.current === recipe.id) return;
    if (recipe.recipeIngredients.length === 0) return;
    if (recipe.userId && !canEditRecipe(recipe.userId)) return;

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
