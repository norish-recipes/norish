import { useEffect, useRef } from "react";
import { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";

import { settleTo } from "./settle-to";

/** The scale a pressed control springs to. */
const PRESSED = 0.96;
/** How long a finger rests before the control dips: a touch that scrolls or swipes away sooner is not a press. */
const PRESS_DELAY_MS = 90;

/** How long a quick tap's dip lasts before it springs back. */
const TAP_DIP_MS = 70;

/** Press feedback: `style` for the control, `press(true)` when a finger lands on it and
 * `press(false)` when it lifts or the gesture is taken; `press(false, true)` when the lift was a tap.
 * A held press dips after a delay, a tap that lifted sooner dips and returns, and a touch that
 * scrolls or swipes away plays nothing. Reduce Motion leaves it still. */
export function usePressScale() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const phaseRef = useRef<"idle" | "waiting" | "dipped" | "done">("idle");
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const settle = (to: number) =>
    scale.set(settleTo(to, { reduceMotion: false, overshootClamping: true }));

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return {
    style,
    press: (down: boolean, tapped = false) => {
      const phase = phaseRef.current;

      clearTimeout(timerRef.current);
      if (reduceMotion) return;
      if (down) {
        phaseRef.current = "waiting";
        timerRef.current = setTimeout(() => {
          phaseRef.current = "dipped";
          settle(PRESSED);
        }, PRESS_DELAY_MS);
      } else if (phase === "dipped") {
        phaseRef.current = "done";
        settle(1);
      } else if (phase !== "done" && tapped) {
        phaseRef.current = "done";
        settle(PRESSED);
        timerRef.current = setTimeout(() => settle(1), TAP_DIP_MS);
      } else {
        phaseRef.current = tapped ? "done" : "idle";
      }
    },
  };
}
