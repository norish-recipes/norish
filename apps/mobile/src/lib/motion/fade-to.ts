import { useEffect } from "react";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { settleTo } from "./settle-to";

/** The animated style for an opacity that follows `opacity`: a spring, a short fade under Reduce
 * Motion. A rise waits `riseDelay` ms; a fall takes exactly `fallMs` when given. */
export function useFadeTo(opacity: number, riseDelay = 0, fallMs?: number) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(opacity);

  useEffect(() => {
    const settle = settleTo(opacity, reduceMotion, { overshootClamping: true });

    if (opacity > shown.get()) shown.set(withDelay(riseDelay, settle));
    else shown.set(fallMs === undefined ? settle : withTiming(opacity, { duration: fallMs }));
  }, [opacity, riseDelay, fallMs, reduceMotion, shown]);

  return useAnimatedStyle(() => ({ opacity: shown.get() }));
}
