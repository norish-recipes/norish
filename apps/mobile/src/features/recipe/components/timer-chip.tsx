import React from "react";
import { Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { TimerMatch } from "@norish/shared/lib/timer-parser";
import { useLoadedPageRecipe } from "@norish/shared-react/recipes";
import { useTimerStore } from "@norish/shared-react/recipes/timers";
import { formatTimerMs } from "@norish/shared/lib/helpers";

import { askTimerNotifications } from "../hooks/use-recipe-timers";
import { TimerRing } from "./timer-ring";
import { useTint } from "./tint";

const SIZES = {
  page: { height: 28, text: "text-[15px]", icon: 15, ring: 15, stroke: 2.3 },
  cook: { height: 34, text: "text-xl", icon: 18, ring: 18, stroke: 2.6 },
} as const;

/** The id web gives a step's timer, so one started on the page is the same in cook mode. */
export const stepTimerId = (recipeId: string, stepIndex: number, index: number) =>
  `${recipeId}-s${stepIndex}-${index}`;

/**
 * A duration in a step as a chip: tap to start, pause or resume; a finished one shows Done and taps
 * away. It sits inside the step's Text, so it flows with the words.
 */
export function TimerChip({
  match,
  index,
  stepIndex,
  size,
}: {
  match: TimerMatch;
  index: number;
  stepIndex: number;
  size: keyof typeof SIZES;
}) {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const tint = useTint();
  const id = stepTimerId(recipe.id, stepIndex, index);
  const timer = useTimerStore((state) => state.timers.find((entry) => entry.id === id));
  const addTimer = useTimerStore((state) => state.addTimer);
  const startTimer = useTimerStore((state) => state.startTimer);
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const removeTimer = useTimerStore((state) => state.removeTimer);
  const [foreground, muted, accentForeground] = useThemeColor([
    "foreground",
    "muted",
    "accent-foreground",
  ] as const);
  const { height, text, icon, ring, stroke } = SIZES[size];
  const done = timer?.status === "completed";
  const left = timer ? formatTimerMs(timer.remainingMs) : "";

  const press = () => {
    if (!timer) {
      addTimer(
        id,
        recipe.id,
        intl.formatMessage({ id: "recipes.cookMode.stepLabel" }, { number: stepIndex + 1 }),
        match.durationSeconds * 1000,
        recipe.name,
        stepIndex
      );
      startTimer(id);
      void askTimerNotifications();
    } else if (timer.status === "running") pauseTimer(id);
    else if (timer.status === "paused") startTimer(id);
    else removeTimer(id);
  };

  const label = !timer
    ? intl.formatMessage({ id: "recipes.cookMode.startTimer" }, { duration: match.originalText })
    : done
      ? intl.formatMessage({ id: "recipes.cookMode.dismissTimer" })
      : intl.formatMessage(
          {
            id:
              timer.status === "running"
                ? "recipes.cookMode.pauseTimer"
                : "recipes.cookMode.resumeTimer",
          },
          { time: left }
        );

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className={`flex-row items-center gap-1.5 rounded-full pr-2.5 pl-2 ${done ? "bg-accent" : "bg-default"}`}
      style={[
        { height, transform: [{ translateY: size === "cook" ? 6 : 5 }] },
        !done && tint ? { backgroundColor: tint.soft } : null,
      ]}
      testID={`timer-chip-${stepIndex}-${index}`}
      onPress={press}
    >
      {!timer ? (
        <Ionicons color={foreground} name="time-outline" size={icon} />
      ) : done ? (
        <Ionicons color={accentForeground} name="checkmark" size={icon} />
      ) : timer.status === "running" ? (
        <TimerRing
          color={foreground}
          left={timer.remainingMs / timer.originalDurationMs}
          size={ring}
          stroke={stroke}
        />
      ) : (
        <Ionicons color={muted} name="play" size={icon - 2} />
      )}
      <Text
        className={`${text} font-medium ${done ? "text-accent-foreground" : timer?.status === "paused" ? "text-muted" : "text-foreground"}`}
        style={timer && !done ? { fontVariant: ["tabular-nums"] } : undefined}
      >
        {!timer
          ? match.originalText
          : done
            ? intl.formatMessage({ id: "common.timer.done" })
            : left}
      </Text>
    </Pressable>
  );
}
