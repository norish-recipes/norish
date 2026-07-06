"use client";

import type { ParsedIngredient } from "@/components/recipes/ingredient-input";
import type { RecipeGalleryMedia } from "@/components/recipes/media-gallery-input";
import type { Step } from "@/components/recipes/step-input";
import { useMemo } from "react";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { FullRecipeDTO, MeasurementSystem, RecipeCategory } from "@norish/shared/contracts";
import { useDirtyState } from "@norish/shared-react/hooks";
import { formatUnit } from "@norish/shared/lib/unit-localization";

interface RecipeFormState {
  name: string;
  description: string;
  notes: string;
  url: string;
  servings: number;
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
}

interface UseRecipeFormDirtyStateOptions {
  current: RecipeFormState;
  initialData?: FullRecipeDTO;
  initializedRecipeId: string | null;
  locale: string;
  mode: "create" | "edit";
  units: UnitsMap;
}

function buildInitialMedia(initialData?: FullRecipeDTO): RecipeGalleryMedia[] {
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
  } else if (initialData?.image) {
    media.push({ type: "image", src: initialData.image, order: 0 });
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
        unit: ing.unit ? formatUnit(ing.unit, locale, units, ing.amount) : null,
        order: ing.order,
        systemUsed: ing.systemUsed,
      })),
      steps: filteredSteps.map((step) => ({
        step: step.step,
        order: step.order,
        systemUsed: step.systemUsed,
        version: step.version,
        images: step.images || [],
      })),
      systemUsed: initialData?.systemUsed ?? "metric",
      media: buildInitialMedia(initialData),
      calories: initialData?.calories ?? null,
      fat: initialData?.fat != null ? Number(initialData.fat) : null,
      carbs: initialData?.carbs != null ? Number(initialData.carbs) : null,
      protein: initialData?.protein != null ? Number(initialData.protein) : null,
    };
  }, [initialData, locale, mode, units]);

  const isDirty = useDirtyState(current, initial);
  const isReady = mode !== "edit" || !initialData || initializedRecipeId === initialData.id;

  return isReady && isDirty;
}
