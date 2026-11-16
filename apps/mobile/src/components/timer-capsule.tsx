import React from "react";
import { Pressable } from "react-native";
import { TimerGlance, useTimersLabel } from "@/components/timer-glance";
import { useRouter } from "expo-router";

import { useTimerStore } from "@norish/shared-react/recipes/timers";

/** The accessory's timer capsule: the soonest countdown and ring, opening the timer list as a sheet. */
export function TimerCapsule() {
  const router = useRouter();
  const timers = useTimerStore((state) => state.timers);
  const label = useTimersLabel(timers);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="bg-default mx-1.5 h-10 flex-row items-center gap-1.5 rounded-full pr-3 pl-[9px]"
      testID="timer-capsule"
      onPress={() => router.push("/timers")}
    >
      <TimerGlance timers={timers} />
    </Pressable>
  );
}
