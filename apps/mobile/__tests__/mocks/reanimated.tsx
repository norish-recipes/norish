// The react-native-reanimated surface the app's component tests render through: `vi.mock` it
// with `() => import(".../__tests__/mocks/reanimated")`. Animations are inert; interpolate is real.
import type { ReactNode } from "react";
import React from "react";

const host = ({ testID, children }: { testID?: string; children?: ReactNode }) => (
  <div data-testid={testID}>{children}</div>
);
// Layout animation builders chain (`FadeIn.duration(200).reduceMotion(...)`) to the same inert one.
const animation: object = new Proxy(() => animation, { get: () => () => animation });
const sharedValue = <T,>(value: T) => {
  const box = { value, get: () => box.value, set: (next: T) => void (box.value = next) };

  return box;
};

export default { View: host, ScrollView: host };
export const ReduceMotion = { System: "system", Always: "always", Never: "never" };
export const FadeIn = animation;
export const FadeOut = animation;
export const FadeInLeft = animation;
export const FadeInRight = animation;
export const FadeOutLeft = animation;
export const FadeOutRight = animation;
export const useReducedMotion = () => false;
export const useSharedValue = sharedValue;
export const useDerivedValue = <T,>(compute: () => T) => sharedValue(compute());
export const useAnimatedStyle = () => ({});
export const useAnimatedReaction = () => {};
export const useAnimatedRef = () => ({ current: null });
export const useScrollOffset = () => sharedValue(0);
export const withSpring = (value: number) => value;
export const cancelAnimation = () => {};
export const useAnimatedScrollHandler = () => undefined;
export const Easing = { bezierFn: () => (t: number) => t };
export const Extrapolation = { CLAMP: "clamp" };
// Piecewise linear over `input`, held at its ends, as `Extrapolation.CLAMP` does.
export const interpolate = (x: number, input: number[], output: number[]) => {
  const last = input.length - 1;
  const at = (i: number) => input[i] ?? 0;
  const to = (i: number) => output[i] ?? 0;

  if (x <= at(0)) return to(0);
  if (x >= at(last)) return to(last);
  const i = input.findIndex((edge) => edge > x) - 1;

  return to(i) + ((x - at(i)) / (at(i + 1) - at(i))) * (to(i + 1) - to(i));
};
