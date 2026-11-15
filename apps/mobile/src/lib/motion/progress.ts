import { Extrapolation, interpolate } from "react-native-reanimated";

/** How far `t` is from `start` to `end`, from 0 to 1, held at either end beyond it. */
export function progress(t: number, start: number, end: number) {
  "worklet";

  return interpolate(t, [start, end], [0, 1], Extrapolation.CLAMP);
}
