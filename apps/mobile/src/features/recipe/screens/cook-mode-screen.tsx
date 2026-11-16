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
import { sprung } from "@/lib/motion/spring";
import { useServerImage } from "@/lib/network/server-url";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
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

// The column clears the header above, and the bar with its progress row below.
const COLUMN_TOP = 140;
const COLUMN_BOTTOM = BAR_BOTTOM + BAR_HEIGHT + 108;

/** The Steps ↔ Ingredients switch: a view slides in from `side` on the pager's spring. */
function viewSwitch(side: "left" | "right", reduceMotion: boolean) {
  if (reduceMotion) return { entering: CROSSFADE_IN, exiting: CROSSFADE_OUT };
  if (side === "left") {
    return { entering: sprung(FadeInLeft.springify()), exiting: sprung(FadeOutLeft.springify()) };
  }

  return { entering: sprung(FadeInRight.springify()), exiting: sprung(FadeOutRight.springify()) };
}

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
  // The step column's own pan pages the steps, under Reduce Motion too.
  const fling = (direction: Directions, onActivate: () => void) => ({
    direction,
    runOnJS: true,
    onActivate,
  });
  const left = useFlingGesture(fling(Directions.LEFT, () => setView("ingredients")));
  const right = useFlingGesture(fling(Directions.RIGHT, () => setView("steps")));
  const swipe = useCompetingGestures(left, right);

  return (
    <TintContext value={tint}>
      <View className="flex-1" style={{ backgroundColor: page }} testID="cook-mode">
        <GestureDetector gesture={swipe}>
          <View className="flex-1" style={{ paddingTop: COLUMN_TOP, paddingBottom: COLUMN_BOTTOM }}>
            {view === "ingredients" ? (
              <Animated.View
                className="absolute inset-0"
                style={{ top: COLUMN_TOP - 10 }}
                {...viewSwitch("right", reduceMotion)}
              >
                <CookIngredients checked={checked} onCheckedChange={setChecked} />
              </Animated.View>
            ) : (
              <Animated.View className="flex-1" {...viewSwitch("left", reduceMotion)}>
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

/** Turns off the Recipes stack's full-screen back swipe while open: it would pop the recipe route
 * under deep-linked cook mode before the screen's own fling. */
function useNoHostBackSwipe() {
  const navigation = useNavigation();

  useEffect(() => {
    const host = navigation.getParent();

    host?.setOptions({ gestureEnabled: false });

    return () => host?.setOptions({ gestureEnabled: true });
  }, [navigation]);
}

/** Cook mode once its recipe loads; until then, or when it is gone, a close so a notification tap never strands. */
export function CookModeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);
  const { top } = useSafeAreaInsets();

  useNoHostBackSwipe();

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
