import React, { useEffect, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TimerGlance, useTimersLabel } from "@/components/timer-glance";
import { lightImpact } from "@/lib/haptics";
import { NATIVE_SPRING } from "@/lib/motion/native-spring";
import { settleTo } from "@/lib/motion/settle-to";
import { Host, Rectangle, RNHostView } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  foregroundStyle,
  frame,
  glassEffect,
  offset,
} from "@expo/ui/swift-ui/modifiers";
import { useIntl } from "react-intl";

import { timerGlance, useTimerStore } from "@norish/shared-react/recipes/timers";

import { HIDE_MS, useMorphFrame } from "../hooks/use-morph-frame";
import { AllTimers } from "./timer-list";

const LIST_RADIUS = 26;
// Content shows once the glass has grown most of the way, so no row hangs outside it.
const CONTENT_DELAY_MS = 240;
// The rows are gone before the glass starts to shrink past them.
const SHRINK = NATIVE_SPRING.delay(HIDE_MS / 1000);
// The countdown returns once the small host has replaced the large one.
const PILL_RETURN_MS = 50;

/** When a closing list has shrunk back into the pill, for what it covered to return. */
export const LIST_SHRUNK_MS = 400;
// Reduce Motion: the glass takes its size in one step, after the rows have faded on a close.
const STEP_AFTER_FADE = Animation.linear({ duration: 0 }).delay(HIDE_MS / 1000);

/** A layer's opacity: in after `delay` once shown, out at once. */
function useLayerFade(shown: boolean, delay: number) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(shown ? 1 : 0);

  useEffect(() => {
    opacity.set(
      shown
        ? withDelay(delay, settleTo(1, reduceMotion, { overshootClamping: true }))
        : withTiming(0, { duration: HIDE_MS })
    );
  }, [shown, delay, reduceMotion, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.get() }));
}

/** The soonest timer on a glass pill that grows into the glass timer list and shrinks back: one
 * glass shape whose frame springs between the two, the pill and the rows fading across inside. */
export function TimerPill({
  open,
  left,
  listLeft = left,
  bottom,
  height,
  listWidth,
  testID,
  onOpenChange,
  onWidthChange,
}: {
  open: boolean;
  /** Where the pill's bottom-left corner sits in the screen; the host is absolute there, as a
   * child outside its parent's bounds gets no touches. */
  left: number;
  /** Where the open list's left edge sits, when it reaches further left than the pill. */
  listLeft?: number;
  bottom: number;
  height: number;
  /** The list grows up from the pill to this width, from `listLeft`. */
  listWidth: number;
  testID: string;
  onOpenChange: (open: boolean) => void;
  /** The closed pill's width, for a bar that keeps the pill's place. */
  onWidthChange?: (width: number) => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const timers = useTimerStore((state) => state.timers);
  const label = useTimersLabel(timers);
  const { large, drawn } = useMorphFrame(open);
  const { height: screenHeight } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const [pillWidth, setPillWidth] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  // Hidden from the tap until the small host is back, so no copy of it shows while the host moves.
  const pillShown = !open && !large;
  const pillFade = useLayerFade(pillShown, PILL_RETURN_MS);
  const listFade = useLayerFade(drawn, CONTENT_DELAY_MS);

  if (!timerGlance(timers).hasTimers) return null;

  const inset = large ? left - listLeft : 0;
  const room = screenHeight - bottom - top;
  const glassAnimation = reduceMotion
    ? drawn
      ? null
      : STEP_AFTER_FADE
    : drawn
      ? NATIVE_SPRING
      : SHRINK;
  const glassWidth = drawn ? listWidth : pillWidth;
  const glassHeight = drawn && listHeight > 0 ? listHeight : height;
  const pill = (
    <Animated.View
      accessibilityElementsHidden={!pillShown}
      // Its own width, never the host's: the bar keeps exactly this much room for it.
      className={large ? "absolute bottom-0" : "self-start"}
      importantForAccessibility={pillShown ? "auto" : "no-hide-descendants"}
      pointerEvents={pillShown ? "auto" : "none"}
      style={[large ? { left: inset } : null, pillFade]}
      onLayout={({ nativeEvent }) => {
        setPillWidth(nativeEvent.layout.width);
        onWidthChange?.(nativeEvent.layout.width);
      }}
    >
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        className="flex-row items-center gap-1.5 pr-3.5 pl-3"
        style={{ height }}
        testID={testID}
        onPress={() => {
          lightImpact();
          onOpenChange(true);
        }}
      >
        <TimerGlance timers={timers} />
      </Pressable>
    </Animated.View>
  );

  return (
    <Host
      alignment="bottomLeading"
      matchContents={!large}
      // Grown to the room the list may take before it is drawn, and kept so until it has shrunk back.
      style={[
        { position: "absolute", left, bottom },
        large ? { left: listLeft, width: listWidth, height: room } : null,
      ]}
    >
      {pillWidth > 0 ? (
        // The one glass shape, behind the content: it springs from the pill to the list and back.
        <Rectangle
          modifiers={[
            foregroundStyle("#00000000"),
            frame({ width: glassWidth, height: glassHeight }),
            glassEffect({
              shape: "roundedRectangle",
              cornerRadius: drawn ? LIST_RADIUS : height / 2,
            }),
            // Over the pill until the list is drawn.
            offset({ x: drawn ? 0 : inset }),
            ...(glassAnimation
              ? [animation(glassAnimation, glassWidth * 10_000 + glassHeight)]
              : []),
          ]}
        />
      ) : null}
      {/* Its own host per size: a host whose child is swapped keeps the old child's size. */}
      <RNHostView key={large ? "list" : "pill"} matchContents>
        {large ? (
          <View pointerEvents="box-none" style={{ width: listWidth, height: room }}>
            {pill}
            <Animated.View
              accessibilityElementsHidden={!drawn}
              accessibilityLabel={intl.formatMessage({ id: "recipes.cookMode.timers" })}
              className="absolute bottom-0 left-0 py-1"
              importantForAccessibility={drawn ? "auto" : "no-hide-descendants"}
              pointerEvents={drawn ? "auto" : "none"}
              style={[{ width: listWidth }, listFade]}
              testID={drawn ? "timer-list" : undefined}
              onLayout={({ nativeEvent }) => setListHeight(nativeEvent.layout.height)}
            >
              <AllTimers onEmpty={() => onOpenChange(false)} />
            </Animated.View>
          </View>
        ) : (
          pill
        )}
      </RNHostView>
    </Host>
  );
}
