"use client";

import { useMemo } from "react";
import { isDirtyState } from "@/lib/dirty-state";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { FullRecipeDTO, MeasurementSystem, RecipeCategory } from "@norish/shared/contracts";
import type { UnitStyle } from "@norish/shared/contracts/zod/device-preferences";
import { formatUnit } from "@norish/shared/lib/unit-localization";

import type { ParsedIngredient } from "./ingredient-input";
import type { RecipeGalleryMedia } from "./media-gallery-input";
import type { ProvenanceFormValue } from "./provenance-fields";
import type { Step } from "./step-input";

interface RecipeFormState {
  name: string;
  description: string;
  notes: string;
  url: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  tags: string[];
  categories: RecipeCategory[];
  ingredients: ParsedIngredient[];
  steps: Step[];
  systemUsed: MeasurementSystem;
  media: RecipeGalleryMedia[];
  calories: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
  provenance: ProvenanceFormValue;
}

interface UseRecipeFormDirtyStateOptions {
  current: RecipeFormState;
  initialData?: FullRecipeDTO;
  initializedRecipeId: string | null;
  locale: string;
  mode: "create" | "edit";
  units: UnitsMap;
  unitStyle: UnitStyle;
}

/** A recipe's images and videos as the media editor holds them, in one order. */
export function buildInitialMedia(initialData?: FullRecipeDTO): RecipeGalleryMedia[] {
  const media: RecipeGalleryMedia[] = [];

  if (initialData?.images && initialData.images.length > 0) {
    initialData.images.forEach((img) => {
      media.push({
        id: img.id,
        type: "image",
        src: img.image,
        order: img.order,
        version: img.version,
      });
    });
  }

  if (initialData?.videos && initialData.videos.length > 0) {
    initialData.videos.forEach((vid) => {
      media.push({
        id: vid.id,
        type: "video",
        src: vid.video,
        thumbnail: vid.thumbnail,
        duration: vid.duration,
        order: vid.order,
        version: vid.version,
      });
    });
  }

  return media.sort((a, b) => a.order - b.order);
}

export function useRecipeFormDirtyState({
  current,
  initialData,
  initializedRecipeId,
  locale,
  mode,
  units,
  unitStyle,
}: UseRecipeFormDirtyStateOptions): boolean {
  const initial = useMemo<RecipeFormState>(() => {
    const filteredIngredients =
      mode === "edit" && initialData
        ? initialData.recipeIngredients.filter((ing) => ing.systemUsed === initialData.systemUsed)
        : [];
    const filteredSteps =
      mode === "edit" && initialData
        ? initialData.steps.filter((step) => step.systemUsed === initialData.systemUsed)
        : [];

    return {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      notes: initialData?.notes ?? "",
      url: initialData?.url ?? "",
      servings: initialData?.servings ?? 1,
      prepMinutes: initialData?.prepMinutes ?? null,
      cookMinutes: initialData?.cookMinutes ?? null,
      totalMinutes: initialData?.totalMinutes ?? null,
      tags: initialData?.tags?.map((tag) => tag.name) ?? [],
      categories: initialData?.categories ?? [],
      ingredients: filteredIngredients.map((ing) => ({
        id: ing.id,
        version: ing.version,
        ingredientName: ing.ingredientName,
        amount: ing.amount,
        unit: ing.unit ? formatUnit(ing.unit, locale, units, ing.amount, unitStyle) : null,
        order: ing.order,
        systemUsed: ing.systemUsed,
      })),
      steps: filteredSteps.map((step) => ({
        step: step.step,
        order: step.order,
        systemUsed: step.systemUsed,
        version: step.version,
        images: step.images || [],
        stepIngredients: step.stepIngredients || [],
      })),
      systemUsed: initialData?.systemUsed ?? "metric",
      media: buildInitialMedia(initialData),
      calories: initialData?.calories ?? null,
      fat: initialData?.fat != null ? Number(initialData.fat) : null,
      carbs: initialData?.carbs != null ? Number(initialData.carbs) : null,
      protein: initialData?.protein != null ? Number(initialData.protein) : null,
      provenance: {
        originCountry: initialData?.originCountry ?? null,
        originCountryName: initialData?.originCountryName ?? null,
        originRegion: initialData?.originRegion ?? "",
        provenanceNote: initialData?.provenanceNote ?? "",
        cuisineIds: initialData?.cuisines.map((cuisine) => cuisine.id) ?? [],
      },
    };
  }, [initialData, locale, mode, units, unitStyle]);

  const isDirty = isDirtyState(current, initial);
  const isReady = mode !== "edit" || !initialData || initializedRecipeId === initialData.id;

  return isReady && isDirty;
}
