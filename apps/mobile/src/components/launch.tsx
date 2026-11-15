import type { LaunchHandoff, LaunchPhase } from "@/lib/boot/launch-motion";
import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import React, { createContext, use, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Brand, useSplashBrandTop } from "@/components/brand";
import { resolveLaunchMotion, resolveSloganStart, stepLaunchClock } from "@/lib/boot/launch-motion";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";
import { progress } from "@/lib/motion/progress";
import * as SplashScreen from "expo-splash-screen";
import { useThemeColor } from "heroui-native";

// The launch timeline, in ms from the JS splash's first frame.
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
  /** Where on the clock the slogan's fade starts, once its messages are in. */
  sloganStart: SharedValue<number | null>;
  done: boolean;
  finish: () => void;
  /** How the splash leaves, decided once the hold ends. */
  motion: LaunchHandoff | null;
  setMotion: (motion: LaunchHandoff) => void;
  /** Server address's brand top, in window points: where the glide lands. */
  target: number | null;
  setTarget: (top: number) => void;
};

const LaunchContext = createContext<Launch | null>(null);

/** Holds the launch's one timeline above the boot gate's branches, so it plays once. */
export function LaunchProvider({ children }: { children: ReactNode }) {
  const clock = useSharedValue(0);
  const sloganStart = useSharedValue<number | null>(null);
  const [done, setDone] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [motion, setMotion] = useState<LaunchHandoff | null>(null);

  return (
    <LaunchContext
      value={{
        clock,
        sloganStart,
        done,
        finish: () => setDone(true),
        motion,
        setMotion,
        target,
        setTarget,
      }}
    >
      {children}
    </LaunchContext>
  );
}

/**
 * Covered until the splash starts to leave (its motion is decided only then), leaving through its
 * fade or glide, then done; done outside a LaunchProvider.
 */
export function useLaunchPhase(): LaunchPhase {
  const launch = use(LaunchContext);

  if (!launch || launch.done) return "done";

  return launch.motion === null ? "covered" : "leaving";
}

/** The JS splash over the screen it hands off to; a `null` handoff holds it. */
export function LaunchSplash({ handoff }: { handoff: LaunchHandoff | null }) {
  const launch = use(LaunchContext);

  if (!launch || launch.done) return null;

  return <LaunchOverlay handoff={handoff} launch={launch} />;
}

function LaunchOverlay({ handoff, launch }: { handoff: LaunchHandoff | null; launch: Launch }) {
  const { clock, sloganStart, finish, motion, setMotion, target } = launch;
  const reduceMotion = useReducedMotion();
  // The device's messages (and, with a server, its enabled locales) have loaded.
  const messagesReady = !useMobileLocaleSettings().isLoading;
  const [background] = useThemeColor(["background"] as const);
  // A remount (the tRPC provider re-keys on sign-in) picks the clock up where it was.
  const [held, setHeld] = useState(() => clock.get() >= HOLD_END);
  // The clock starts once this frame is on screen, so the slogan fades in visibly.
  const [shown, setShown] = useState(() => clock.get() > 0);
  const top = useSplashBrandTop();
  const decided = held ? resolveLaunchMotion(handoff, reduceMotion, target) : null;
  const glide = motion === "glide";

  // Decided once the hold ends, so a target landing mid-fade can't turn it into a glide.
  useEffect(() => {
    if (motion === null && decided !== null) setMotion(decided);
  }, [decided, motion, setMotion]);

  const end = motion === null ? HOLD_END : motion === "glide" ? LAUNCH_END : FADE_END;
  const stop = shown ? end : 0;

  // Stepped per frame rather than timed, so a stalled frame slows the launch instead of skipping it.
  useFrameCallback(({ timeSincePreviousFrame }) => {
    const now = clock.get();

    if (now >= stop) return;

    sloganStart.set(
      resolveSloganStart(sloganStart.get(), now, messagesReady, HOLD_END - SLOGAN_IN)
    );

    const next = stepLaunchClock(now, timeSincePreviousFrame, stop);

    clock.set(next);

    if (next < stop) return;

    if (stop === HOLD_END) {
      scheduleOnRN(setHeld, true);
    } else {
      clock.set(LAUNCH_END);
      scheduleOnRN(finish);
    }
  });

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
  const sloganStyle = useAnimatedStyle(() => {
    const start = sloganStart.get();

    return { opacity: start === null ? 0 : progress(clock.get(), start, start + SLOGAN_IN) };
  });

  // Hidden only once this frame is mounted, or the native splash reveals an empty window;
  // hide only queues the removal on the main queue, so the fade may start a frame early.
  const onLayout = () => {
    void SplashScreen.hideAsync().then(() => setShown(true));
  };

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fill, overlayStyle]}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.fill, { backgroundColor: background }, groundStyle]} />
      <Animated.View style={[styles.brand, { top }, brandStyle]}>
        <Brand sloganStyle={sloganStyle} />
      </Animated.View>
    </Animated.View>
  );
}

function rise(clock: number, [start, end]: readonly [number, number]) {
  "worklet";

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
  // A fading splash cross-fades to this screen, so it is drawn whole beneath it.
  const fading = launch?.motion === "fade";

  const brandStyle = useAnimatedStyle(() => ({
    opacity: fading || clock.get() >= GLIDE_END ? 1 : 0,
  }));
  const fieldStyle = useAnimatedStyle(() => rise(fading ? LAUNCH_END : clock.get(), FIELD_RISE));
  const buttonStyle = useAnimatedStyle(() => rise(fading ? LAUNCH_END : clock.get(), BUTTON_RISE));

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
