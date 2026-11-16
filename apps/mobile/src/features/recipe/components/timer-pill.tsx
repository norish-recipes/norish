import React, { useId } from "react";
import { Pressable, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { TimerGlance, useTimersLabel } from "@/components/timer-glance";
import { lightImpact } from "@/lib/haptics";
import { NATIVE_FADE, NATIVE_SPRING } from "@/lib/motion/native-spring";
import {
  GlassEffectContainer,
  Host,
  HStack,
  Namespace,
  RNHostView,
  VStack,
} from "@expo/ui/swift-ui";
import { animation, glassEffect, glassEffectId } from "@expo/ui/swift-ui/modifiers";
import { useIntl } from "react-intl";

import { timerGlance, useTimerStore } from "@norish/shared-react/recipes/timers";

import { AllTimers } from "./timer-list";

const LIST_RADIUS = 26;

/** The soonest timer on a glass pill that grows into the glass timer list and shrinks back: one
 * glass id in a `GlassEffectContainer`, so SwiftUI morphs the one shape into the other. */
export function TimerPill({
  open,
  left,
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
  bottom: number;
  height: number;
  /** The list grows up and right from the pill's bottom-left corner to this width. */
  listWidth: number;
  testID: string;
  onOpenChange: (open: boolean) => void;
  /** The closed pill's width, for a bar that keeps the pill's place. */
  onWidthChange?: (width: number) => void;
}) {
  const intl = useIntl();
  const namespaceId = useId();
  const reduceMotion = useReducedMotion();
  const timers = useTimerStore((state) => state.timers);
  const label = useTimersLabel(timers);

  if (!timerGlance(timers).hasTimers) return null;

  // Under Reduce Motion the shapes keep no shared id, so the one fades into the other.
  const glass = (shape: "capsule" | "roundedRectangle") => [
    glassEffect({ shape, cornerRadius: LIST_RADIUS }),
    ...(reduceMotion ? [] : [glassEffectId("timers", namespaceId)]),
  ];

  return (
    <Host
      matchContents
      alignment="bottomLeading"
      style={{ position: "absolute", left, bottom }}
      onLayoutContent={({ nativeEvent }) => {
        if (!open) onWidthChange?.(nativeEvent.width);
      }}
    >
      <Namespace id={namespaceId}>
        <GlassEffectContainer
          modifiers={[animation(reduceMotion ? NATIVE_FADE : NATIVE_SPRING, open)]}
        >
          {open ? (
            <VStack modifiers={glass("roundedRectangle")}>
              <RNHostView matchContents>
                <View
                  accessibilityLabel={intl.formatMessage({ id: "recipes.cookMode.timers" })}
                  className="py-1"
                  style={{ width: listWidth }}
                  testID="timer-list"
                >
                  <AllTimers onEmpty={() => onOpenChange(false)} />
                </View>
              </RNHostView>
            </VStack>
          ) : (
            <HStack modifiers={glass("capsule")}>
              <RNHostView matchContents>
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
              </RNHostView>
            </HStack>
          )}
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}
