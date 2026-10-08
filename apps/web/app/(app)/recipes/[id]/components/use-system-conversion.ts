"use client";

import { useMemo } from "react";
import { usePermissionsContext } from "@/context/permissions-context";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { useTranslations } from "next-intl";

import type { MeasurementSystem } from "@norish/shared/contracts";

import { useRecipeContextRequired } from "../context";

export type SystemConversionOption = {
  key: string;
  system: MeasurementSystem;
  label: string;
  /** The language model writes the copy in this system again. */
  withAI: boolean;
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
      { key: original, system: original, label: label(original), withAI: false },
      { key: other, system: other, label: label(other), withAI: false },
    ];

    if (isAIEnabled) {
      built.push({
        key: `${other}-ai`,
        system: other,
        label: other === "metric" ? t("toMetricWithAI") : t("toUSWithAI"),
        withAI: true,
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
