import React, { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCloseButton } from "@/components/glass";
import { useHideTabBar } from "@/lib/tab-bar-visibility";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { resolveCookingModeSteps, useRecipeQuery } from "@norish/shared-react/recipes";

import { MediaViewer } from "../components/media-viewer";
import { heroItems, imageItems } from "../utils/hero-items";

type Params = { id: string; start?: string; step?: string; cook?: string };

function viewerItems(recipe: FullRecipeDTO, { step, cook }: Params) {
  const system = recipe.systemUsed ?? "metric";

  if (step === undefined && cook === undefined) return heroItems(recipe);

  const photos =
    cook === undefined
      ? recipe.steps?.find((s) => s.order === Number(step) && s.systemUsed === system)?.images
      : resolveCookingModeSteps(recipe.steps ?? [], system).find(
          (s) => s.stepNumber === Number(cook)
        )?.images;

  return imageItems(photos ?? []);
}

/** The viewer's route: the hero's items, or the photos of the step named by `step`, from `start`.
 * With nothing to show, a gone recipe or a step without photos, it leaves: it has no back swipe. */
export function MediaViewerScreen() {
  const intl = useIntl();
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const { recipe, isLoading } = useRecipeQuery(params.id);
  const { top } = useSafeAreaInsets();
  const items = recipe ? viewerItems(recipe, params) : [];
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
        params.step === undefined && params.cook === undefined
          ? recipe.name
          : intl.formatMessage({ id: "recipes.detail.stepPhoto" })
      }
      start={Math.min(Number(params.start) || 0, items.length - 1)}
      onClose={() => router.back()}
    />
  );
}
