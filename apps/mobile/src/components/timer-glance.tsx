import React from "react";
import { Text } from "react-native";
import { RollingText } from "@/components/rolling-text";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { Timer } from "@norish/shared-react/recipes/timers";
import { formatTimerMs } from "@norish/shared/lib/helpers";

import { TimerRing } from "./timer-ring";

/** The soonest timer's ring and rolling countdown; a check and Done when every timer is. */
export function TimerGlance({ soonest }: { soonest: Timer | undefined }) {
  const intl = useIntl();
  const [foreground, accent] = useThemeColor(["foreground", "accent"] as const);

  return (
    <>
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
      {soonest ? (
        <RollingText
          className="text-foreground text-base font-semibold"
          rising={false}
          value={formatTimerMs(soonest.remainingMs)}
        />
      ) : (
        <Text className="text-foreground text-base font-semibold">
          {intl.formatMessage({ id: "common.timer.done" })}
        </Text>
      )}
    </>
  );
}
