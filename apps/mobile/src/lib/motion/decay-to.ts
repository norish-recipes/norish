import { withDecay } from "react-native-reanimated";

/** A fling from `current` at `velocity`, coasting to rest inside `clamp`; under Reduce Motion it stops where it is. */
export function decayTo(
  current: number,
  {
    velocity,
    clamp,
    reduceMotion,
  }: { velocity: number; clamp: [number, number]; reduceMotion: boolean }
) {
  "worklet";

  return reduceMotion ? current : withDecay({ velocity, clamp });
}
