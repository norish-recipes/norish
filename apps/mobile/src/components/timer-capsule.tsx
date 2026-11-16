import React from "react";
import { Pressable, View } from "react-native";
import { TimerGlance, useTimersLabel } from "@/components/timer-glance";
import { useRouter } from "expo-router";

import { useTimerStore } from "@norish/shared-react/recipes/timers";

/** The accessory's timer: the soonest countdown and ring on the accessory's own glass, after a
 * hairline when an action sits beside it, opening the timer list as a sheet. */
export function TimerCapsule({ divided }: { divided: boolean }) {
  const router = useRouter();
  const timers = useTimerStore((state) => state.timers);
  const label = useTimersLabel(timers);

  return (
    <View className="flex-row items-center">
      {divided ? <View className="bg-separator h-6 w-px" /> : null}
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        className="h-11 min-w-11 flex-row items-center gap-1.5 pr-3 pl-2.5"
        testID="timer-capsule"
        onPress={() => router.push("/timers")}
      >
        <TimerGlance timers={timers} />
      </Pressable>
    </View>
  );
}
