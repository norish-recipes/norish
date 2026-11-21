import type { SharedValue } from "react-native-reanimated";
import { Easing, FadeIn, FadeInDown, ReduceMotion } from "react-native-reanimated";
import { EASE_OUT } from "@/lib/motion/ease";
import { timedTo } from "@/lib/motion/timed";

// Reanimated snaps every animation under Reduce Motion, so the plain fade opts out of that.
export const FADE_IN = FadeIn.duration(240).reduceMotion(ReduceMotion.Never);

// An error rising into its field; Reduce Motion falls back to FADE_IN.
export const RISE_IN = FadeInDown.duration(240)
  .easing(EASE_OUT)
  .withInitialValues({ transform: [{ translateY: 16 }] });

/** Runs a badge's clock from 0 to `duration` after `delay`; callers skip it under Reduce Motion. */
export function playBadge(clock: SharedValue<number>, duration: number, delay: number) {
  clock.set(0);
  // Kept, so a started play runs on rather than snapping to its end.
  clock.set(timedTo(duration, duration, { easing: Easing.linear, delay, keep: true }));
}
