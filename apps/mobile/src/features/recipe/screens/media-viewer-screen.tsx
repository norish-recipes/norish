import React from "react";
import { useHideTabBar } from "@/lib/tab-bar-visibility";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { resolveCookingModeSteps, useLoadedPageRecipe } from "@norish/shared-react/recipes";

import { MediaViewer } from "../components/media-viewer";
import { heroItems, imageItems } from "../utils/hero-items";

/** The viewer's route: the hero's items, or the photos of the step named by `step`, from `start`. */
export function MediaViewerScreen() {
  const intl = useIntl();
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const { start, step, cook } = useLocalSearchParams<{
    start?: string;
    step?: string;
    cook?: string;
  }>();
  const system = recipe.systemUsed ?? "metric";
  const hero = step === undefined && cook === undefined;
  const photos =
    cook === undefined
      ? recipe.steps?.find((s) => s.order === Number(step) && s.systemUsed === system)?.images
      : resolveCookingModeSteps(recipe.steps ?? [], system).find(
          (s) => s.stepNumber === Number(cook)
        )?.images;
  const items = hero ? heroItems(recipe) : imageItems(photos ?? []);

  useHideTabBar();

  if (items.length === 0) return null;

  return (
    <MediaViewer
      items={items}
      label={hero ? recipe.name : intl.formatMessage({ id: "recipes.detail.stepPhoto" })}
      start={Math.min(Number(start) || 0, items.length - 1)}
      onClose={() => router.back()}
    />
  );
}
