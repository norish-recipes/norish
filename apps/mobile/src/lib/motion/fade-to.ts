import { useEffect } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";

import { settleTo } from "./settle-to";

/** The animated style for an opacity that follows `opacity`: a spring, a short fade under Reduce Motion. */
export function useFadeTo(opacity: number) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(opacity);

  useEffect(() => {
    shown.set(settleTo(opacity, reduceMotion, { overshootClamping: true }));
  }, [opacity, reduceMotion, shown]);

  return useAnimatedStyle(() => ({ opacity: shown.get() }));
}
