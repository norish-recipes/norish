import { useEffect, useRef } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";

import { settleTo } from "./settle-to";

/** The kick that swells the value to about 14%, which the app's spring then settles. */
const POP_VELOCITY = 6;

/** The style of a view that swells and springs back when `value` changes; still under Reduce Motion. */
export function usePopOnChange(value: unknown) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const seenRef = useRef(value);

  useEffect(() => {
    if (seenRef.current === value) return;
    seenRef.current = value;
    if (!reduceMotion) scale.set(settleTo(1, { reduceMotion, velocity: POP_VELOCITY }));
  }, [value, reduceMotion, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}
