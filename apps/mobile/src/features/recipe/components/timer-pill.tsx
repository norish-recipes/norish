import React, { useEffect, useEffectEvent, useState } from "react";
import { Pressable, useWindowDimensions } from "react-native";
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
import { Host, HStack, Rectangle, RNHostView } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentShape,
  foregroundStyle,
  frame,
  glassEffect,
  offset,
  onTapGesture,
  shapes,
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

  const hasTimers = timerGlance(timers).hasTimers;
  const close = useEffectEvent(() => onOpenChange(false));

  // The list goes with its last timer before its own empty check can run, so the pill closes it.
  useEffect(() => {
    if (open && !hasTimers) close();
  }, [open, hasTimers]);

  if (!hasTimers) return null;

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
      className="self-start"
      importantForAccessibility={pillShown ? "auto" : "no-hide-descendants"}
      pointerEvents={pillShown ? "auto" : "none"}
      style={pillFade}
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
      matchContents
      alignment="bottomLeading"
      // Mid-push the screen's safe area reaches the host and lifts the pill until the push settles.
      ignoreSafeArea="all"
      style={{ position: "absolute", left: large ? listLeft : left, bottom }}
    >
      {large ? (
        // Grown to the room the list may take before it is drawn, and kept so until it has shrunk back.
        // A tap there closes the list, as the scrim does elsewhere: the host takes those touches.
        <Rectangle
          modifiers={[
            foregroundStyle("#00000000"),
            frame({ width: listWidth, height: room }),
            ...(drawn
              ? [
                  contentShape(shapes.rectangle()),
                  onTapGesture(() => {
                    lightImpact();
                    onOpenChange(false);
                  }),
                ]
              : []),
          ]}
        />
      ) : null}
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
            // Keyed on open and the list's height only: the host growing must not animate the glass.
            ...(glassAnimation ? [animation(glassAnimation, drawn ? 1 + listHeight : 0)] : []),
          ]}
        />
      ) : null}
      {/* Each in a host of its own size: rows inside one screen-tall hosted view got no touches. */}
      <HStack modifiers={[offset({ x: inset })]}>
        <RNHostView matchContents>{pill}</RNHostView>
      </HStack>
      {large ? (
        <RNHostView matchContents>
          <Animated.View
            accessibilityElementsHidden={!drawn}
            accessibilityLabel={intl.formatMessage({ id: "recipes.cookMode.timers" })}
            className="py-1"
            importantForAccessibility={drawn ? "auto" : "no-hide-descendants"}
            pointerEvents={drawn ? "auto" : "none"}
            style={[{ width: listWidth }, listFade]}
            testID={drawn ? "timer-list" : undefined}
            onLayout={({ nativeEvent }) => setListHeight(nativeEvent.layout.height)}
          >
            <AllTimers onEmpty={() => onOpenChange(false)} />
          </Animated.View>
        </RNHostView>
      ) : null}
    </Host>
  );
}
