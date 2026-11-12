import type { SharedValue } from "react-native-reanimated";
import {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { SESSION_END_FADE_MS } from "@/lib/auth/auth-session-sync";

// Reanimated snaps every animation under Reduce Motion, so the plain fade opts out of that.
export const FADE_IN = FadeIn.duration(240).reduceMotion(ReduceMotion.Never);

// An error rising into its field; Reduce Motion falls back to FADE_IN.
export const RISE_IN = FadeInDown.duration(240)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ transform: [{ translateY: 16 }] });

// A session end's signed-in screen fading out; a plain fade under Reduce Motion too.
export const FADE_OUT_TIMING = {
  duration: SESSION_END_FADE_MS,
  reduceMotion: ReduceMotion.Never,
};

// A pending spinner waits this long before fading in, so a quick session read never shows one.
export const PENDING_FADE_IN = FADE_IN.delay(400);

/** Runs a badge's clock from 0 to `duration` after `delay`; callers skip it under Reduce Motion. */
export function playBadge(clock: SharedValue<number>, duration: number, delay: number) {
  clock.set(0);
  // The opt-out only keeps a started play running, so it isn't snapped to its end.
  clock.set(
    withDelay(
      delay,
      withTiming(duration, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never })
    )
  );
}
