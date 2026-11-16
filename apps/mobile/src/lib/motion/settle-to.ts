import { withSpring, withTiming } from "react-native-reanimated";

import { SPRING } from "./spring";

const REDUCED_MS = 150;

/** The animation of a value to `to`: the app's spring, a short fade under Reduce Motion. */
export function settleTo(
  to: number,
  reduceMotion: boolean,
  config?: { velocity?: number; overshootClamping?: boolean },
  callback?: (finished?: boolean) => void
) {
  "worklet";

  return reduceMotion
    ? withTiming(to, { duration: REDUCED_MS }, callback)
    : withSpring(to, { ...SPRING, ...config }, callback);
}
