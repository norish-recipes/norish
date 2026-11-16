import { useEffect, useRef } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";

import { settleTo } from "./settle-to";

/** The scale a pressed control springs to. */
const PRESSED = 0.96;
/** How long a finger rests before the control dips: a touch that scrolls or swipes away sooner is not a press. */
const PRESS_DELAY_MS = 90;

/** Press feedback: `style` for the control, `press(true)` when a finger lands on it and
 * `press(false)` when it lifts or the gesture is taken. Reduce Motion leaves it still. */
export function usePressScale() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const settle = (to: number) =>
    scale.set(settleTo(to, { reduceMotion: false, overshootClamping: true }));

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return {
    style,
    press: (down: boolean) => {
      clearTimeout(timerRef.current);
      if (reduceMotion) return;
      if (down) timerRef.current = setTimeout(() => settle(PRESSED), PRESS_DELAY_MS);
      else settle(1);
    },
  };
}
