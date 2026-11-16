import { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";

import { settleTo } from "./settle-to";

/** The scale a pressed control springs to. */
const PRESSED = 0.96;

/** Press feedback: `style` for the control, `press(true)` when a finger lands on it and
 * `press(false)` when it lifts or the gesture is taken. Reduce Motion leaves it still. */
export function usePressScale() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return {
    style,
    press: (down: boolean) => {
      if (!reduceMotion)
        scale.set(settleTo(down ? PRESSED : 1, false, { overshootClamping: true }));
    },
  };
}
