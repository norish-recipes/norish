import React from "react";
import { Pressable, View } from "react-native";
import { TimerGlance } from "@/components/timer-glance";
import { timerGlance } from "@/lib/timer-order";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useTimerStore } from "@norish/shared-react/recipes/timers";

/** The accessory's timer capsule: the soonest countdown and ring, opening the timer list as a sheet. */
export function TimerCapsule() {
  const intl = useIntl();
  const router = useRouter();
  const { soonest, anyDone } = timerGlance(useTimerStore((state) => state.timers));

  return (
    <Pressable
      accessibilityLabel={intl.formatMessage({ id: "recipes.cookMode.timers" })}
      accessibilityRole="button"
      className="bg-default mx-1.5 h-10 flex-row items-center gap-1.5 rounded-full pr-3 pl-[9px]"
      testID="timer-capsule"
      onPress={() => router.push("/timers")}
    >
      <TimerGlance soonest={soonest} />
      {anyDone && soonest ? (
        <View className="bg-accent absolute top-0.5 right-0.5 size-[9px] rounded-full" />
      ) : null}
    </Pressable>
  );
}
