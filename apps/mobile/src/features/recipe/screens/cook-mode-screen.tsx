import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import {
  Directions,
  GestureDetector,
  useCompetingGestures,
  useFlingGesture,
} from "react-native-gesture-handler";
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCloseButton } from "@/components/glass";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useServerImage } from "@/lib/network/server-url";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";

import { useIngredientIcons } from "@norish/shared-react/ingredients";
import { useDevicePreference } from "@norish/shared-react/reader";
import {
  clampStep,
  resolveCookingModeSteps,
  useLoadedPageRecipe,
  useRecipePageStore,
  useRecipeQuery,
} from "@norish/shared-react/recipes";
import { formatMinutesHM } from "@norish/shared/lib/helpers";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

import type { CookView } from "../components/cook-bar";
import { BAR_BOTTOM, BAR_HEIGHT, CookBar } from "../components/cook-bar";
import { CookIngredients } from "../components/cook-ingredients";
import { CookSteps, CROSSFADE_IN, CROSSFADE_OUT } from "../components/cook-steps";
import { FadeEdge } from "../components/fade-edge";
import { isRecipeNotFound, RecipeNotFound } from "../components/recipe-not-found";
import { TimerList } from "../components/timer-list";
import { TintContext } from "../components/tint";
import { dishTint } from "../utils/dish-tint";

function CookHeader({ onClose }: { onClose: () => void }) {
  const categoryLabel = useCategoryLabel();
  const recipe = useLoadedPageRecipe();
  const toImage = useServerImage();
  const { top } = useSafeAreaInsets();
  const image = primaryRecipeImage(recipe);
  const subtitle = [
    recipe.categories.map(categoryLabel).join(", "),
    recipe.totalMinutes ? formatMinutesHM(recipe.totalMinutes) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="flex-row items-center gap-3 pr-4 pl-5" style={{ paddingTop: top + 6 }}>
      {image ? (
        <Image className="bg-default size-[46px] rounded-[14px]" source={toImage(image)} />
      ) : null}
      <View className="min-w-0 flex-1 gap-px">
        <Text className="text-foreground text-[17px] font-semibold" numberOfLines={1}>
          {recipe.name}
        </Text>
        {subtitle ? (
          <Text className="text-muted text-sm" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <GlassCloseButton testID="cook-close" onPress={onClose} />
    </View>
  );
}

/** Turns `wakeLock` on while open, which ScreenKeepAwake makes the native hold; hands back only its own. */
function useCookKeepAwake() {
  const wakeLock = useRecipePageStore((state) => state.wakeLock);
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);
  const [took] = useState(() => wakeLock === "off");

  useEffect(() => {
    if (!took) return;
    setWakeLock("held");

    return () => setWakeLock("off");
  }, [took, setWakeLock]);
}

/** One Cooking Session over the recipe, Ready At fixed when it opened; a notification opens it on `step`. */
function CookMode() {
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();
  const recipe = useLoadedPageRecipe();
  const scheme = useResolvedColorScheme();
  const [colorMode] = useDevicePreference("recipePageColor");
  const [background] = useThemeColor(["background"] as const);
  const steps = resolveCookingModeSteps(recipe.steps ?? [], recipe.systemUsed ?? "metric");
  const [step, setStep] = useState(() => clampStep(Number(params.step ?? 0) || 0, steps.length));
  const [view, setView] = useState<CookView>("steps");
  const [timersOpen, setTimersOpen] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set());
  const [readyAt] = useState(() =>
    recipe.totalMinutes && recipe.totalMinutes > 0
      ? Date.now() + recipe.totalMinutes * 60_000
      : null
  );
  const tint = colorMode === "dish" ? dishTint(recipe.dishColor, scheme) : null;
  const page = tint?.page ?? background;
  const current = clampStep(step, steps.length);
  // A light haptic once a step change is decided: a button, a peek tap, a fling or a release.
  const goTo = (next: number) => {
    const target = clampStep(next, steps.length);

    if (target !== current) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(target);
  };

  useCookKeepAwake();
  useIngredientIcons(recipe.recipeIngredients.map((line) => line.ingredientId));

  // A new notification tap while cook mode is open moves it to that timer's step.
  useEffect(() => {
    if (params.step !== undefined) setStep(Number(params.step) || 0);
  }, [params.step]);

  const reduceMotion = useReducedMotion();
  const fling = (direction: Directions, onActivate: () => void, { enabled = true } = {}) => ({
    direction,
    enabled,
    runOnJS: true,
    onActivate,
  });
  // The step column's drag pages the steps it shows; a fling pages from Ingredients or under Reduce Motion.
  const stepFling = (direction: Directions, delta: number) =>
    fling(
      direction,
      () => {
        setView("steps");
        goTo(current + delta);
      },
      { enabled: reduceMotion || view === "ingredients" }
    );
  const up = useFlingGesture(stepFling(Directions.UP, 1));
  const down = useFlingGesture(stepFling(Directions.DOWN, -1));
  const left = useFlingGesture(fling(Directions.LEFT, () => setView("ingredients")));
  const right = useFlingGesture(fling(Directions.RIGHT, () => setView("steps")));
  const swipe = useCompetingGestures(up, down, left, right);

  return (
    <TintContext value={tint}>
      <View className="flex-1" style={{ backgroundColor: page }} testID="cook-mode">
        <GestureDetector gesture={swipe}>
          <View className="flex-1" style={{ paddingTop: 140, paddingBottom: 190 }}>
            {view === "ingredients" ? (
              <Animated.View
                className="absolute inset-0"
                entering={reduceMotion ? CROSSFADE_IN : FadeInRight.duration(260)}
                exiting={reduceMotion ? CROSSFADE_OUT : FadeOutRight.duration(200)}
                style={{ top: 130 }}
              >
                <CookIngredients checked={checked} onCheckedChange={setChecked} />
              </Animated.View>
            ) : (
              <Animated.View
                className="flex-1"
                entering={reduceMotion ? CROSSFADE_IN : FadeInLeft.duration(260)}
                exiting={reduceMotion ? CROSSFADE_OUT : FadeOutLeft.duration(200)}
              >
                <CookSteps current={current} steps={steps} onStepChange={goTo} />
              </Animated.View>
            )}
          </View>
        </GestureDetector>
        <FadeEdge color={page} edge="top" height={170} solidFraction={0.7} />
        <FadeEdge color={page} edge="bottom" height={250} solidFraction={0.52} />
        <View className="absolute top-0 right-0 left-0">
          <CookHeader onClose={() => router.back()} />
        </View>
        <CookBar
          current={current}
          readyAt={readyAt}
          total={steps.length}
          view={view}
          onDone={() => router.back()}
          onStepChange={goTo}
          onTimersOpen={() => setTimersOpen(true)}
          onViewChange={setView}
        />
        {timersOpen ? (
          <TimerList bottom={BAR_BOTTOM + BAR_HEIGHT + 12} onClose={() => setTimersOpen(false)} />
        ) : null}
      </View>
    </TintContext>
  );
}

/** Cook mode once its recipe loads; until then, or when it is gone, a close so a notification tap never strands. */
export function CookModeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);
  const { top } = useSafeAreaInsets();

  if (recipe) return <CookMode />;

  return (
    <View className="bg-background flex-1" testID="cook-mode-loading">
      {isRecipeNotFound(error) ? <RecipeNotFound /> : null}
      <View className="absolute right-4" style={{ top: top + 6 }}>
        <GlassCloseButton testID="cook-close" onPress={() => router.back()} />
      </View>
    </View>
  );
}
