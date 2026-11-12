import type { LaunchHandoff } from "@/lib/boot/boot-state";
import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import React, { createContext, use, useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Brand, LOGO_HEIGHT } from "@/components/brand";
import { resolveLaunchMotion } from "@/lib/boot/boot-state";
import { useThemeColor } from "heroui-native";

// The launch timeline in ms from the JS splash's first frame, after the Launch board.
const SLOGAN_IN = 400;
const HOLD_END = 900;
const FADE_END = 1200;
const GLIDE_END = 1600;
const FIELD_RISE = [1300, 1900] as const;
const BUTTON_RISE = [1500, 2100] as const;
const LAUNCH_END = 2100;
const RISE_DISTANCE = 16;

const glideEasing = Easing.bezierFn(0.65, 0, 0.35, 1);
const riseEasing = Easing.bezierFn(0.2, 0.7, 0.3, 1);

type Launch = {
  /** Runs the timeline once; it rests at LAUNCH_END from then on. */
  clock: SharedValue<number>;
  done: boolean;
  finish: () => void;
  /** Server address's brand top, in window points: where the glide lands. */
  target: number | null;
  setTarget: (top: number) => void;
};

const LaunchContext = createContext<Launch | null>(null);

/** Holds the launch's one timeline above the boot gate's branches, so it plays once. */
export function LaunchProvider({ children }: { children: ReactNode }) {
  const clock = useSharedValue(0);
  const [done, setDone] = useState(false);
  const [target, setTarget] = useState<number | null>(null);

  return (
    <LaunchContext value={{ clock, done, finish: () => setDone(true), target, setTarget }}>
      {children}
    </LaunchContext>
  );
}

/** The JS splash over the screen it hands off to; a `null` handoff holds it. */
export function LaunchSplash({ handoff }: { handoff: LaunchHandoff | null }) {
  const launch = use(LaunchContext);

  if (!launch || launch.done) return null;

  return <LaunchOverlay handoff={handoff} launch={launch} />;
}

function LaunchOverlay({ handoff, launch }: { handoff: LaunchHandoff | null; launch: Launch }) {
  const { clock, finish, target } = launch;
  const reduceMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const [background] = useThemeColor(["background"] as const);
  // A remount (the tRPC provider re-keys on sign-in) picks the clock up where it was.
  const [held, setHeld] = useState(() => clock.get() >= HOLD_END);
  // The native splash centres the logo on the window, so this frame does too.
  const top = (height - LOGO_HEIGHT) / 2;
  // Decided once the hold ends, so a target landing mid-fade can't turn it into a glide.
  const [motion, setMotion] = useState<LaunchHandoff | null>(null);
  const decided = held ? resolveLaunchMotion(handoff, reduceMotion, target) : null;

  if (motion === null && decided !== null) setMotion(decided);

  const glide = motion === "glide";

  useEffect(() => {
    if (held) return;

    clock.set(
      withTiming(
        HOLD_END,
        { duration: HOLD_END - clock.get(), easing: Easing.linear },
        (finished) => {
          if (finished) scheduleOnRN(setHeld, true);
        }
      )
    );
  }, [clock, held]);

  useEffect(() => {
    if (motion === null) return;

    const end = motion === "glide" ? LAUNCH_END : FADE_END;

    clock.set(
      withTiming(
        end,
        { duration: Math.max(0, end - clock.get()), easing: Easing.linear },
        (finished) => {
          if (!finished) return;

          clock.set(LAUNCH_END);
          scheduleOnRN(finish);
        }
      )
    );
  }, [clock, finish, motion]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: glide ? 1 : 1 - progress(clock.get(), HOLD_END, FADE_END),
  }));
  // Server address draws only the ground under a glide, so the splash's own ground can go.
  const groundStyle = useAnimatedStyle(() => ({
    opacity: glide && clock.get() > HOLD_END ? 0 : 1,
  }));
  const brandStyle = useAnimatedStyle(() => {
    const glided = progress(clock.get(), HOLD_END, GLIDE_END);

    return {
      // Server address shows its own brand on the same frame this one hides.
      opacity: glide && clock.get() >= GLIDE_END ? 0 : 1,
      transform: [
        { translateY: glide && target !== null ? glideEasing(glided) * (target - top) : 0 },
      ],
    };
  });
  const sloganStyle = useAnimatedStyle(() => ({
    opacity: progress(clock.get(), 0, SLOGAN_IN),
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fill, overlayStyle]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: background }, groundStyle]} />
      <Animated.View style={[styles.brand, { top }, brandStyle]}>
        <Brand sloganStyle={sloganStyle} />
      </Animated.View>
    </Animated.View>
  );
}

/** How far the clock is from `start` to `end`, from 0 to 1. */
function progress(clock: number, start: number, end: number) {
  "worklet";

  return interpolate(clock, [start, end], [0, 1], Extrapolation.CLAMP);
}

function rise(clock: number, [start, end]: readonly [number, number], reduceMotion: boolean) {
  "worklet";

  if (reduceMotion) {
    return { opacity: progress(clock, HOLD_END, FADE_END), transform: [{ translateY: 0 }] };
  }

  const risen = progress(clock, start, end);

  return {
    opacity: risen,
    transform: [{ translateY: (1 - riseEasing(risen)) * RISE_DISTANCE }],
  };
}

/** Server address's side of the glide: its brand takes over as the splash's lands, then the form rises in. */
export function useLaunchEntrance() {
  const launch = use(LaunchContext);
  const settled = useSharedValue(LAUNCH_END);
  const clock = launch?.clock ?? settled;
  const reduceMotion = useReducedMotion();

  const brandStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? progress(clock.get(), HOLD_END, FADE_END)
      : clock.get() >= GLIDE_END
        ? 1
        : 0,
  }));
  const fieldStyle = useAnimatedStyle(() => rise(clock.get(), FIELD_RISE, reduceMotion));
  const buttonStyle = useAnimatedStyle(() => rise(clock.get(), BUTTON_RISE, reduceMotion));

  const onBrandLayout = ({ currentTarget }: LayoutChangeEvent) => {
    if (typeof currentTarget !== "number") {
      currentTarget.measureInWindow((_x, y) => launch?.setTarget(y));
    }
  };

  return { onBrandLayout, brandStyle, fieldStyle, buttonStyle };
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "none" },
  brand: { position: "absolute", left: 0, right: 0 },
});
