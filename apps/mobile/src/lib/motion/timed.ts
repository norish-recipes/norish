import type { EasingFunction } from "react-native-reanimated";
import { ReduceMotion, withDelay, withSequence, withTiming } from "react-native-reanimated";

/** A timed move to `to` after `delay` ms; Reduce Motion snaps it to its end unless `keep`, as a fade
 * or a badge's clock, which are not movement. */
export function timedTo(
  to: number,
  durationMs: number,
  {
    easing,
    delay = 0,
    keep = false,
  }: { easing?: EasingFunction; delay?: number; keep?: boolean } = {},
  callback?: (finished?: boolean) => void
) {
  "worklet";

  const timed = withTiming(
    to,
    {
      duration: durationMs,
      reduceMotion: keep ? ReduceMotion.Never : ReduceMotion.System,
      ...(easing ? { easing } : {}),
    },
    callback
  );

  return delay > 0 ? withDelay(delay, timed) : timed;
}

/** A run through `stops`, `stepMs` each: a shake's beats. */
export function stepsThrough(stops: readonly number[], stepMs: number) {
  "worklet";

  return withSequence(...stops.map((to) => timedTo(to, stepMs)));
}
