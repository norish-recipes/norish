import { useEffect } from "react";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
} from "react-native-reanimated";

import { settleTo } from "./settle-to";

/** The animated style for an opacity that follows `opacity`: a spring, a short fade under Reduce Motion;
 * a rise waits `riseDelay` ms. */
export function useFadeTo(opacity: number, riseDelay = 0) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(opacity);

  useEffect(() => {
    const settle = settleTo(opacity, reduceMotion, { overshootClamping: true });

    shown.set(opacity > shown.get() ? withDelay(riseDelay, settle) : settle);
  }, [opacity, riseDelay, reduceMotion, shown]);

  return useAnimatedStyle(() => ({ opacity: shown.get() }));
}
