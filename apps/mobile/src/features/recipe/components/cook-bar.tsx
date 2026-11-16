import React from "react";
import { Pressable, Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { TimerGlance, useTimersLabel } from "@/components/timer-glance";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useTimersEnabledQuery } from "@norish/shared-react/config";
import { useRecipePageStore } from "@norish/shared-react/recipes";
import { timerGlance, useTimerStore } from "@norish/shared-react/recipes/timers";

import { useTint } from "./tint";

export type CookView = "steps" | "ingredients";

// On the 34 pt home-indicator inset: the glass Host stops at the safe area and would cut a lower bar.
export const BAR_BOTTOM = 34;
export const BAR_HEIGHT = 48;

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
  const tint = useTint();
  const timers = useTimerStore((state) => state.timers);
  const [foreground] = useThemeColor(["foreground"] as const);
  const intl = useIntl();
  const timersLabel = useTimersLabel(timers);

  if (!timerGlance(timers).any) {
    const label = intl.formatMessage({ id: "recipes.cookMode.timers" });

    return (
      <BarButton disabled label={label} testID="cook-timers" onPress={onPress}>
        <Ionicons color={foreground} name="timer-outline" size={21} />
      </BarButton>
    );
  }

  return (
    <Pressable
      accessibilityLabel={timersLabel}
      accessibilityRole="button"
      className="bg-default mx-0.5 h-10 flex-row items-center gap-1.5 rounded-full pr-3 pl-[9px]"
      style={tint ? { backgroundColor: tint.soft } : undefined}
      testID="cook-timers"
      onPress={onPress}
    >
      <TimerGlance timers={timers} />
    </Pressable>
  );
}

export function CookBar({
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
