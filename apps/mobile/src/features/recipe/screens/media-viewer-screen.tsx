import type { ViewerParams, ViewerStep } from "@/lib/tab-routes";
import React, { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCloseButton } from "@/components/glass";
import { useHideTabBar } from "@/lib/tab-bar-visibility";
import { viewerParamsOf } from "@/lib/tab-routes";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { resolveCookingModeSteps, useRecipeQuery } from "@norish/shared-react/recipes";

import { MediaViewer } from "../components/media-viewer";
import { heroItems, imageItems } from "../utils/hero-items";

function viewerItems(recipe: FullRecipeDTO, step: ViewerStep | undefined) {
  const system = recipe.systemUsed ?? "metric";

  if (step === undefined) return heroItems(recipe);

  const photos =
    "order" in step
      ? recipe.steps?.find((s) => s.order === step.order && s.systemUsed === system)?.images
      : resolveCookingModeSteps(recipe.steps ?? [], system).find(
          (s) => s.stepNumber === step.stepNumber
        )?.images;

  return imageItems(photos ?? []);
}

/** The viewer's route: the hero's items, or the photos of the step named by `step`, from `start`.
 * With nothing to show, a gone recipe or a step without photos, it leaves: it has no back swipe. */
export function MediaViewerScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { id, ...params } = useLocalSearchParams<ViewerParams & { id: string }>();
  const { start, step } = viewerParamsOf(params);
  const { recipe, isLoading } = useRecipeQuery(id);
  const { top } = useSafeAreaInsets();
  const items = recipe ? viewerItems(recipe, step) : [];
  const empty = !isLoading && items.length === 0;

  useHideTabBar();

  useEffect(() => {
    if (empty) router.back();
  }, [empty, router]);

  if (!recipe || items.length === 0) {
    return (
      <View className="flex-1 bg-black">
        <View className="absolute right-5" style={{ top: top + 6 }}>
          <GlassCloseButton
            color="accent-foreground"
            testID="media-viewer-close"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <MediaViewer
      items={items}
      label={
        step === undefined ? recipe.name : intl.formatMessage({ id: "recipes.detail.stepPhoto" })
      }
      start={Math.min(start, items.length - 1)}
      onClose={() => router.back()}
    />
  );
}
