import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { GlassSurface } from "@/components/glass";
import { TimerRing } from "@/components/timer-ring";
import { sortTimers } from "@/lib/timer-order";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Notifications from "expo-notifications";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { Timer } from "@norish/shared-react/recipes/timers";
import { timerAdjustStep, useTimerStore } from "@norish/shared-react/recipes/timers";
import { formatTimerMs } from "@norish/shared/lib/helpers";

import { useTint } from "./tint";

function RoundAction({
  icon,
  label,
  onPress,
  plain = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  plain?: boolean;
}) {
  const tint = useTint();
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className={`size-9 items-center justify-center rounded-full ${plain ? "" : "bg-default"}`}
      hitSlop={4}
      style={!plain && tint ? { backgroundColor: tint.soft } : undefined}
      onPress={onPress}
    >
      <Ionicons color={plain ? muted : foreground} name={icon} size={plain ? 16 : 15} />
    </Pressable>
  );
}

function TimerRow({ timer, first }: { timer: Timer; first: boolean }) {
  const intl = useIntl();
  const startTimer = useTimerStore((state) => state.startTimer);
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const resetTimer = useTimerStore((state) => state.resetTimer);
  const removeTimer = useTimerStore((state) => state.removeTimer);
  const adjustTimer = useTimerStore((state) => state.adjustTimer);
  const [accent, accentForeground] = useThemeColor(["accent", "accent-foreground"] as const);
  const done = timer.status === "completed";
  const step = timerAdjustStep(timer.originalDurationMs);
  const stepText = formatTimerMs(step);

  return (
    <View
      className={`flex-row items-center gap-2 py-2.5 pr-2.5 pl-3.5 ${first ? "" : "border-separator border-t"}`}
      testID={`timer-row-${timer.id}`}
    >
      <View className="w-[30px] items-center">
        {done ? (
          <View className="bg-accent size-6 items-center justify-center rounded-full">
            <Ionicons color={accentForeground} name="checkmark" size={14} />
          </View>
        ) : (
          <TimerRing
            color={accent}
            left={timer.remainingMs / timer.originalDurationMs}
            size={28}
            stroke={3}
          />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-foreground text-[15px] font-semibold" numberOfLines={1}>
          {timer.label}
        </Text>
        {timer.recipeName ? (
          <Text className="text-muted text-[13px]" numberOfLines={1}>
            {timer.recipeName}
          </Text>
        ) : null}
      </View>
      <Text
        className={`text-xl font-semibold ${done ? "text-accent-text" : timer.status === "paused" ? "text-muted" : "text-foreground"}`}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {done ? intl.formatMessage({ id: "common.timer.done" }) : formatTimerMs(timer.remainingMs)}
      </Text>
      {done ? (
        <RoundAction
          icon="refresh"
          label={intl.formatMessage({ id: "recipes.cookMode.restartTimer" })}
          onPress={() => {
            resetTimer(timer.id);
            startTimer(timer.id);
          }}
        />
      ) : (
        <>
          <RoundAction
            icon="remove"
            label={intl.formatMessage({ id: "recipes.cookMode.decreaseTimer" }, { time: stepText })}
            onPress={() => adjustTimer(timer.id, -step)}
          />
          <RoundAction
            icon="add"
            label={intl.formatMessage({ id: "recipes.cookMode.increaseTimer" }, { time: stepText })}
            onPress={() => adjustTimer(timer.id, step)}
          />
          <RoundAction
            icon={timer.status === "running" ? "pause" : "play"}
            label={intl.formatMessage(
              {
                id:
                  timer.status === "running"
                    ? "recipes.cookMode.pauseTimer"
                    : "recipes.cookMode.resumeTimer",
              },
              { time: formatTimerMs(timer.remainingMs) }
            )}
            onPress={() =>
              timer.status === "running" ? pauseTimer(timer.id) : startTimer(timer.id)
            }
          />
        </>
      )}
      <RoundAction
        plain
        icon="close"
        label={intl.formatMessage({ id: "recipes.cookMode.dismissTimer" })}
        onPress={() => removeTimer(timer.id)}
      />
    </View>
  );
}

/** Whether the reader refused notifications, so timers ring only in the app. */
function useNotificationsRefused(): boolean {
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    void Notifications.getPermissionsAsync().then(
      (permission) => setRefused(permission.status === "denied"),
      () => setRefused(false)
    );
  }, []);

  return refused;
}

/** Every timer on the device, with pause, adjust, restart and dismiss; `onEmpty` when the last goes. */
export function TimerRows({ onEmpty }: { onEmpty: () => void }) {
  const intl = useIntl();
  const timers = sortTimers(useTimerStore((state) => state.timers));
  const refused = useNotificationsRefused();

  useEffect(() => {
    if (timers.length === 0) onEmpty();
  }, [timers.length, onEmpty]);

  return (
    <>
      {timers.map((timer, index) => (
        <TimerRow key={timer.id} first={index === 0} timer={timer} />
      ))}
      {refused ? (
        <Text className="text-muted border-separator border-t px-4 py-2.5 text-[13px]">
          {intl.formatMessage({ id: "recipes.cookMode.notificationsOff" })}
        </Text>
      ) : null}
    </>
  );
}

/** The clock pill's popover in cook mode: the timer rows over a scrim. */
export function TimerList({ bottom, onClose }: { bottom: number; onClose: () => void }) {
  const intl = useIntl();

  return (
    <>
      <Animated.View
        className="absolute inset-0"
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
      >
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: "common.actions.close" })}
          className="flex-1 bg-black/10"
          testID="timer-list-scrim"
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        accessibilityLabel={intl.formatMessage({ id: "recipes.cookMode.timers" })}
        className="absolute right-5 left-5 overflow-hidden rounded-[26px] py-1"
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(150)}
        style={{ bottom }}
        testID="timer-list"
      >
        <GlassSurface radius={26} />
        <TimerRows onEmpty={onClose} />
      </Animated.View>
    </>
  );
}
