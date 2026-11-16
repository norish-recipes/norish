import React from "react";
import { Text, View } from "react-native";
import { RollingText } from "@/components/rolling-text";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { Timer } from "@norish/shared-react/recipes/timers";
import { countdownSlots, spokenDuration, timerGlance } from "@norish/shared-react/recipes/timers";
import { formatTimerMs } from "@norish/shared/lib/helpers";

import { TimerRing } from "./timer-ring";

/** What a screen reader says of the timers: the soonest as a spoken duration, its state, any done. */
export function useTimersLabel(timers: readonly Timer[]): string {
  const intl = useIntl();
  const { soonest, anyDone } = timerGlance(timers);
  const name = intl.formatMessage({ id: "recipes.cookMode.timers" });

  if (!soonest) return `${name}, ${intl.formatMessage({ id: "common.timer.done" })}`;

  const time = intl
    .formatMessage({ id: "recipes.cookMode.spokenTime" }, spokenDuration(soonest.remainingMs))
    .trim();
  const left = intl.formatMessage({ id: "recipes.cookMode.timersLeft" }, { time });

  return [
    left,
    soonest.status === "paused" ? intl.formatMessage({ id: "common.timer.paused" }) : null,
    anyDone ? intl.formatMessage({ id: "common.timer.done" }) : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The soonest timer's ring and rolling countdown (muted, play ring, when paused), a check and Done
 * when every timer is done, and a dot when any is. */
export function TimerGlance({ timers }: { timers: readonly Timer[] }) {
  const intl = useIntl();
  const [foreground, muted, accent] = useThemeColor(["foreground", "muted", "accent"] as const);
  const { soonest, anyDone } = timerGlance(timers);
  const paused = soonest?.status === "paused";
  return (
    <>
      {soonest ? (
        paused ? (
          <Ionicons color={muted} name="play" size={18} />
        ) : (
          <TimerRing
            color={foreground}
            left={soonest.remainingMs / soonest.originalDurationMs}
            size={20}
            stroke={2.6}
          />
        )
      ) : (
        <Ionicons color={accent} name="checkmark-circle" size={20} />
      )}
      {soonest ? (
        <RollingText
          className={`${paused ? "text-muted" : "text-foreground"} text-base font-semibold`}
          rising={false}
          slots={countdownSlots(soonest)}
          value={formatTimerMs(soonest.remainingMs)}
        />
      ) : (
        <Text className="text-foreground text-base font-semibold">
          {intl.formatMessage({ id: "common.timer.done" })}
        </Text>
      )}
      {anyDone && soonest ? (
        <View className="bg-accent absolute top-0.5 right-0.5 size-[9px] rounded-full" />
      ) : null}
    </>
  );
}
