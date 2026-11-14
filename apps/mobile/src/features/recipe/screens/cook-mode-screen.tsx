import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import {
  Directions,
  GestureDetector,
  useCompetingGestures,
  useFlingGesture,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCloseButton } from "@/components/glass-close-button";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useServerImage } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useTimersEnabledQuery } from "@norish/shared-react/config";
import { useIngredientIcons } from "@norish/shared-react/ingredients";
import { useDevicePreference } from "@norish/shared-react/reader";
import {
  clampStep,
  formatServings,
  resolveCookingModeSteps,
  useAmountDisplayPreference,
  useLoadedPageRecipe,
  usePageIngredients,
  usePageServings,
  useRecipePageStore,
  useRecipeQuery,
  useUnitFormatter,
} from "@norish/shared-react/recipes";
import { useTimerStore } from "@norish/shared-react/recipes/timers";
import { isBuiltInCategory } from "@norish/shared/lib/categories";
import { formatAmount } from "@norish/shared/lib/format-amount";
import { formatMinutesHM, formatTimerMs } from "@norish/shared/lib/helpers";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

import { CookSteps } from "../components/cook-steps";
import { FadeEdge } from "../components/fade-edge";
import { GlassSurface } from "../components/glass-surface";
import { Line, OptionsMenu, ServingsControl } from "../components/ingredients-section";
import { sortTimers, TimerList } from "../components/timer-list";
import { TimerRing } from "../components/timer-ring";
import { TintContext, useTint } from "../components/tint";
import { dishTint } from "../utils/dish-tint";
import { ingredientRows } from "../utils/recipe-rows";

type CookView = "steps" | "ingredients";

/** The bar's height above the screen's foot, where the timer list opens above it. */
const BAR_BOTTOM = 26;
const BAR_HEIGHT = 56;

function CookHeader({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const toImage = useServerImage();
  const { top } = useSafeAreaInsets();
  const image = primaryRecipeImage(recipe);
  const subtitle = [
    recipe.categories
      .map((name) =>
        isBuiltInCategory(name)
          ? intl.formatMessage({ id: `recipes.form.category.${name.toLowerCase()}` })
          : name
      )
      .join(", "),
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

/** The recipe's lines at the page's servings, large and tickable for this Cooking Session. */
function CookIngredients({
  checked,
  onCheckedChange,
}: {
  checked: ReadonlySet<number>;
  onCheckedChange: (checked: ReadonlySet<number>) => void;
}) {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const servings = usePageServings();
  const display = usePageIngredients();
  const { mode } = useAmountDisplayPreference();
  const { formatUnitOnly } = useUnitFormatter(intl.locale);
  const toggle = (index: number) => {
    const next = new Set(checked);

    if (!next.delete(index)) next.add(index);
    onCheckedChange(next);
  };

  return (
    <ScrollView
      contentContainerClassName="px-5 pt-6 pb-48"
      showsVerticalScrollIndicator={false}
      testID="cook-ingredients"
    >
      <View className="flex-row items-baseline justify-between">
        <Text className="text-foreground text-[28px] font-semibold tracking-[-0.6px]">
          {intl.formatMessage({ id: "recipes.cookMode.ingredients" })}
        </Text>
        {recipe.servings ? (
          <Text className="text-muted text-base">
            {intl.formatMessage(
              { id: "recipes.cookMode.serving" },
              { count: formatServings(servings) }
            )}
          </Text>
        ) : null}
      </View>
      <View className="mt-3.5 mb-1.5 flex-row items-center justify-between">
        {recipe.servings ? <ServingsControl /> : <View />}
        <OptionsMenu />
      </View>
      {ingredientRows(display, recipe.systemUsed).map((row) =>
        row.kind === "heading" ? (
          <Text
            key={row.key}
            className="text-muted border-separator border-t pt-[18px] pb-2 text-[15px] font-semibold"
          >
            {row.text}
          </Text>
        ) : (
          <Line
            key={row.key}
            large
            amount={formatAmount(row.line.amount, mode)}
            checked={checked.has(row.index)}
            index={row.index}
            ingredientId={row.line.ingredientId}
            name={row.line.ingredientName}
            unit={row.line.unit ? formatUnitOnly(row.line.unit, row.line.amount) : ""}
            onToggle={toggle}
          />
        )
      )}
    </ScrollView>
  );
}

function BarButton({
  label,
  selected,
  pressed,
  disabled,
  testID,
  onPress,
  children,
}: {
  label: string;
  selected?: boolean;
  /** A toggle that is on, read out as such but not filled. */
  pressed?: boolean;
  disabled?: boolean;
  testID: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const tint = useTint();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: selected ?? pressed }}
      className={`h-12 w-[46px] items-center justify-center rounded-full ${selected ? "bg-default" : ""}`}
      disabled={disabled}
      style={[
        selected && tint ? { backgroundColor: tint.soft } : null,
        { opacity: disabled ? 0.35 : 1 },
      ]}
      testID={testID}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

/** The clock in the bar; with timers it shows the soonest one's ring and time, and a dot for any done. */
function TimersButton({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  const tint = useTint();
  const timers = sortTimers(useTimerStore((state) => state.timers));
  const [foreground, accent] = useThemeColor(["foreground", "accent"] as const);
  const soonest = timers.find((timer) => timer.status !== "completed");
  const anyDone = timers.some((timer) => timer.status === "completed");
  const label = intl.formatMessage({ id: "recipes.cookMode.timers" });

  if (timers.length === 0) {
    return (
      <BarButton disabled label={label} testID="cook-timers" onPress={onPress}>
        <Ionicons color={foreground} name="timer-outline" size={21} />
      </BarButton>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="bg-default mx-0.5 h-10 flex-row items-center gap-1.5 rounded-full pr-3 pl-[9px]"
      style={tint ? { backgroundColor: tint.soft } : undefined}
      testID="cook-timers"
      onPress={onPress}
    >
      {soonest ? (
        <TimerRing
          color={foreground}
          left={soonest.remainingMs / soonest.originalDurationMs}
          size={20}
          stroke={2.6}
        />
      ) : (
        <Ionicons color={accent} name="checkmark-circle" size={20} />
      )}
      <Text
        className="text-foreground text-base font-semibold"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {soonest
          ? formatTimerMs(soonest.remainingMs)
          : intl.formatMessage({ id: "common.timer.done" })}
      </Text>
      {anyDone && soonest ? (
        <View className="bg-accent absolute top-0.5 right-0.5 size-[9px] rounded-full" />
      ) : null}
    </Pressable>
  );
}

function CookBar({
  current,
  total,
  view,
  readyAt,
  onStepChange,
  onViewChange,
  onTimersOpen,
  onDone,
}: {
  current: number;
  total: number;
  view: CookView;
  readyAt: number | null;
  onStepChange: (step: number) => void;
  onViewChange: (view: CookView) => void;
  onTimersOpen: () => void;
  onDone: () => void;
}) {
  const intl = useIntl();
  const { timersEnabled } = useTimersEnabledQuery();
  const keepAwake = useRecipePageStore((state) => state.wakeLock !== "off");
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);
  const [foreground, accent, accentForeground] = useThemeColor([
    "foreground",
    "accent",
    "accent-foreground",
  ] as const);
  const last = current >= total - 1;
  const counter = intl.formatMessage(
    { id: "recipes.cookMode.stepCounter" },
    { current: current + 1, total }
  );

  return (
    <View className="absolute right-5 left-5 gap-3" style={{ bottom: BAR_BOTTOM }}>
      <View className="gap-2">
        <View
          accessibilityLabel={counter}
          accessibilityRole="progressbar"
          className="bg-default h-1.5 overflow-hidden rounded-full"
        >
          <View
            className="bg-accent h-1.5 rounded-full"
            style={{ width: `${total > 0 ? ((current + 1) / total) * 100 : 0}%` }}
          />
        </View>
        <View className="flex-row justify-between">
          <Text className="text-muted text-sm">
            {readyAt
              ? intl.formatMessage(
                  { id: "recipes.cookMode.readyAt" },
                  { time: intl.formatTime(readyAt, { hour: "numeric", minute: "2-digit" }) }
                )
              : ""}
          </Text>
          <Text className="text-muted text-sm" style={{ fontVariant: ["tabular-nums"] }}>
            {counter}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2.5">
        <View className="flex-row items-center rounded-full px-1" style={{ height: BAR_HEIGHT }}>
          <GlassSurface radius={BAR_HEIGHT / 2} />
          <BarButton
            disabled={current <= 0}
            label={intl.formatMessage({ id: "recipes.cookMode.previousStep" })}
            testID="cook-previous"
            onPress={() => {
              onViewChange("steps");
              onStepChange(current - 1);
            }}
          >
            <Ionicons color={foreground} name="chevron-up" size={21} />
          </BarButton>
          {timersEnabled ? <TimersButton onPress={onTimersOpen} /> : null}
          <BarButton
            label={intl.formatMessage({
              id:
                view === "ingredients" ? "recipes.cookMode.steps" : "recipes.cookMode.ingredients",
            })}
            selected={view === "ingredients"}
            testID="cook-view-toggle"
            onPress={() => onViewChange(view === "ingredients" ? "steps" : "ingredients")}
          >
            <Ionicons color={foreground} name="book-outline" size={21} />
          </BarButton>
          <BarButton
            label={intl.formatMessage({ id: "recipes.wakeLock.ariaLabel" })}
            pressed={keepAwake}
            testID="cook-keep-awake"
            onPress={() => setWakeLock(keepAwake ? "off" : "held")}
          >
            <Ionicons
              color={keepAwake ? accent : foreground}
              name={keepAwake ? "phone-portrait" : "phone-portrait-outline"}
              size={20}
            />
          </BarButton>
        </View>
        <Pressable
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-2 rounded-full"
          style={{ height: BAR_HEIGHT }}
          testID="cook-next"
          onPress={() => {
            if (last) {
              onDone();

              return;
            }
            onViewChange("steps");
            onStepChange(current + 1);
          }}
        >
          <GlassSurface radius={BAR_HEIGHT / 2} tint={accent} />
          <Text className="text-accent-foreground text-[17px] font-semibold">
            {intl.formatMessage({
              id: last ? "common.actions.done" : "recipes.cookMode.nextStep",
            })}
          </Text>
          <Ionicons color={accentForeground} name={last ? "checkmark" : "chevron-down"} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

/** Holds the screen awake while cook mode is open, handing back only a hold it took itself. */
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

/**
 * Cook mode: one Cooking Session over the recipe, steps or ingredients, with Ready At fixed when it
 * opened. Opened on `step` by a timer's notification; a new session otherwise starts at the first.
 */
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
  const goTo = (next: number) => setStep(clampStep(next, steps.length));

  useCookKeepAwake();
  useIngredientIcons(recipe.recipeIngredients.map((line) => line.ingredientId));

  // A new notification tap while cook mode is open moves it to that timer's step.
  useEffect(() => {
    if (params.step !== undefined) setStep(Number(params.step) || 0);
  }, [params.step]);

  const fling = (direction: Directions, onActivate: () => void) => ({
    direction,
    runOnJS: true,
    onActivate,
  });
  const up = useFlingGesture(
    fling(Directions.UP, () => {
      setView("steps");
      goTo(current + 1);
    })
  );
  const down = useFlingGesture(
    fling(Directions.DOWN, () => {
      setView("steps");
      goTo(current - 1);
    })
  );
  const left = useFlingGesture(fling(Directions.LEFT, () => setView("ingredients")));
  const right = useFlingGesture(fling(Directions.RIGHT, () => setView("steps")));
  const swipe = useCompetingGestures(up, down, left, right);

  return (
    <TintContext value={tint}>
      <View className="flex-1" style={{ backgroundColor: page }} testID="cook-mode">
        <GestureDetector gesture={swipe}>
          <View className="flex-1" style={{ paddingTop: 140, paddingBottom: 190 }}>
            {view === "ingredients" ? (
              <View className="absolute inset-0" style={{ top: 130 }}>
                <CookIngredients checked={checked} onCheckedChange={setChecked} />
              </View>
            ) : (
              <CookSteps current={current} steps={steps} onStepChange={goTo} />
            )}
          </View>
        </GestureDetector>
        <FadeEdge color={page} edge="top" height={170} solidFrom={0.7} />
        <FadeEdge color={page} edge="bottom" height={250} solidFrom={0.52} />
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

export function CookModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe } = useRecipeQuery(id);
  const [background] = useThemeColor(["background"] as const);

  return recipe ? (
    <CookMode />
  ) : (
    <View className="flex-1" style={{ backgroundColor: background }} testID="cook-mode-loading" />
  );
}
