import { useEffect, useRef } from "react";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
} from "react-native-reanimated";

import { settleTo } from "./settle-to";

/** The kick that swells the value to about 14%, which the app's spring then settles. */
const POP_VELOCITY = 6;

/** The style of a view that swells and springs back, after `delayMs`, when `value` changes; `settleTo` leaves no swell under Reduce Motion. */
export function usePopOnChange(value: unknown, delayMs = 0) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const seenRef = useRef(value);

  useEffect(() => {
    if (seenRef.current === value) return;
    seenRef.current = value;
    scale.set(withDelay(delayMs, settleTo(1, { reduceMotion, velocity: POP_VELOCITY })));
  }, [value, delayMs, reduceMotion, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}
