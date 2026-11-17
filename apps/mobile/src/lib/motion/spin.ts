import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** A style that turns its view once per `durationMs`, forever; it stays still under Reduce Motion. */
export function useSpinStyle(durationMs: number) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.set(withRepeat(withTiming(360, { duration: durationMs, easing: Easing.linear }), -1));
  }, [reduceMotion, durationMs, turn]);

  return useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
}
