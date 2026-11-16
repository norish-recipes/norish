// The react-native-reanimated surface the app's component tests render through: `vi.mock` it
// with `() => import(".../__tests__/mocks/reanimated")`. Values hold still, animations are inert.
import type { ReactNode } from "react";
import React from "react";

const host = ({ testID, children }: { testID?: string; children?: ReactNode }) => (
  <div data-testid={testID}>{children}</div>
);
// Layout animation builders chain (`FadeIn.duration(200).reduceMotion(...)`) to the same inert one.
const animation: object = new Proxy(() => animation, { get: () => () => animation });
const sharedValue = <T,>(value: T) => ({ get: () => value, set: () => {} });

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
