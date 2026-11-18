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

/** A scale's swell and spring back to 1 after `delayMs`; `settleTo` leaves no swell under Reduce Motion. */
export const popAfter = (delayMs: number, reduceMotion: boolean) =>
  withDelay(delayMs, settleTo(1, { reduceMotion, velocity: POP_VELOCITY }));

/** The style of a view that swells and springs back when `value` changes. */
export function usePopOnChange(value: unknown) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const seenRef = useRef(value);

  useEffect(() => {
    if (seenRef.current === value) return;
    seenRef.current = value;
    scale.set(popAfter(0, reduceMotion));
  }, [value, reduceMotion, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}
