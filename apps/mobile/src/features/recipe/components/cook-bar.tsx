import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { GlassSurface } from "@/components/glass";
import { useTimersName } from "@/components/timer-glance";
import { labelFits } from "@/lib/label-fits";
import { useFadeTo } from "@/lib/motion/fade-to";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useTimersEnabledQuery } from "@norish/shared-react/config";
import { useRecipePageStore } from "@norish/shared-react/recipes";
import { timerGlance, useTimerStore } from "@norish/shared-react/recipes/timers";

import { MORPH } from "../hooks/use-morph-frame";
import { useTint } from "./tint";

export type CookView = "steps" | "ingredients";

// On the 34 pt home-indicator inset: the glass Host stops at the safe area and would cut a lower bar.
export const BAR_BOTTOM = 34;
export const BAR_HEIGHT = 48;
export const BAR_SIDE = 20;

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** What Next needs beside its label: the chevron, the gap and a side padding each way. */
const NEXT_CHROME = 20 + 6 + 2 * 6;

const PILL_HEIGHT = 40;

/** Where cook mode lays the timer pill over the bar: after the group's padding, Previous and the
 * pill's margin, centred in the bar. */
export const COOK_PILL = {
  left: BAR_SIDE + 4 + 46 + 2,
  bottom: BAR_BOTTOM + (BAR_HEIGHT - PILL_HEIGHT) / 2,
  height: PILL_HEIGHT,
};

/** The clock in the bar; with timers, the place the timer pill floats over. */
function TimersButton({ pillWidth }: { pillWidth: number }) {
  const timers = useTimerStore((state) => state.timers);
  const [foreground] = useThemeColor(["foreground"] as const);
  const name = useTimersName();

  if (!timerGlance(timers).hasTimers) {
    return (
      <BarButton disabled label={name} testID="cook-timers" onPress={() => {}}>
        <Ionicons color={foreground} name="timer-outline" size={21} />
      </BarButton>
    );
  }

  return <View className="mx-0.5" style={{ width: pillWidth, height: PILL_HEIGHT }} />;
}

export function CookBar({
  current,
  total,
  view,
  readyAt,
  onStepChange,
  onViewChange,
  pillWidth,
  nextHidden,
  onDone,
}: {
  current: number;
  total: number;
  view: CookView;
  readyAt: number | null;
  onStepChange: (step: number) => void;
  onViewChange: (view: CookView) => void;
  /** The timer pill's width, whose place the bar keeps. */
  pillWidth: number;
  /** While the timer list covers it: its tint would glow through the list's glass. */
  nextHidden: boolean;
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
  const nextFade = useFadeTo(nextHidden ? 0 : 1, MORPH.listShrunk);
  const nextLabel = intl.formatMessage({
    id: last ? "common.actions.done" : "recipes.cookMode.nextStep",
  });
  const [nextWidth, setNextWidth] = useState<number | null>(null);
  const [labelWidth, setLabelWidth] = useState<number | null>(null);
  const nextFits = labelFits(nextWidth, labelWidth, NEXT_CHROME);
  const counter = intl.formatMessage(
    { id: "recipes.cookMode.stepCounter" },
    { current: current + 1, total }
  );

  return (
    <View
      className="absolute gap-3"
      style={{ bottom: BAR_BOTTOM, left: BAR_SIDE, right: BAR_SIDE }}
    >
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
          {timersEnabled ? <TimersButton pillWidth={pillWidth} /> : null}
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
        <AnimatedPressable
          accessibilityElementsHidden={nextHidden}
          accessibilityLabel={nextLabel}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-1.5"
          disabled={nextHidden}
          style={[{ height: BAR_HEIGHT }, nextFade]}
          testID="cook-next"
          onLayout={({ nativeEvent }) => setNextWidth(nativeEvent.layout.width)}
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
          {/* Measured at its own width, so a long word or a wide timer pill drops it, not clips it. */}
          <View
            accessibilityElementsHidden
            className="absolute top-0 left-0 w-[1000px] items-start opacity-0"
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          >
            <Text
              className="text-[17px] font-semibold"
              onLayout={({ nativeEvent }) => setLabelWidth(nativeEvent.layout.width)}
            >
              {nextLabel}
            </Text>
          </View>
          {/* Unmeasured, it keeps its place unseen: drawn first and dropped after, it would flash. */}
          {nextFits !== false ? (
            <Text
              className={`text-accent-foreground text-[17px] font-semibold ${nextFits === null ? "opacity-0" : ""}`}
              numberOfLines={1}
            >
              {nextLabel}
            </Text>
          ) : null}
          <Ionicons color={accentForeground} name={last ? "checkmark" : "chevron-down"} size={20} />
        </AnimatedPressable>
      </View>
    </View>
  );
}
