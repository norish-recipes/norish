import { springTo } from "./spring";
import { timedTo } from "./timed";

const REDUCED_MS = 150;

/** The animation of a value to `to`: the app's spring, a short fade under Reduce Motion. */
export function settleTo(
  to: number,
  {
    reduceMotion,
    ...config
  }: { reduceMotion: boolean; velocity?: number; overshootClamping?: boolean },
  callback?: (finished?: boolean) => void
) {
  "worklet";

  return reduceMotion ? timedTo(to, REDUCED_MS, {}, callback) : springTo(to, config, callback);
}
