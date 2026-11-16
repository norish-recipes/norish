import { useEffect } from "react";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { SPRING } from "./spring";

/** The animated style for an opacity that follows `opacity`: a spring, a short fade under Reduce Motion. */
export function useFadeTo(opacity: number) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(opacity);

  useEffect(() => {
    shown.set(
      reduceMotion
        ? withTiming(opacity, { duration: 150 })
        : withSpring(opacity, { ...SPRING, overshootClamping: true })
    );
  }, [opacity, reduceMotion, shown]);

  return useAnimatedStyle(() => ({ opacity: shown.get() }));
}
