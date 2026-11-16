import React from "react";
import { View } from "react-native";
import { GestureDetector, Pressable, useNativeGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useScrollOffset,
  useSharedValue,
} from "react-native-reanimated";
import { useIntl } from "react-intl";

import type { ResolvedCookingModeStep } from "@norish/shared-react/recipes";

import type { StepPager } from "../hooks/use-step-pager";
import { PEEK_SLOT, slotPose } from "../utils/cook-pager";
import { PeekBody, StepBody } from "./cook-step-body";

/** One step, posed by its distance from the pager's position: full in the middle or as its
 * peek. Keyed by step, so a step change moves no slot. */
export function StepSlot({
  step,
  index,
  current,
  pager,
  onPeekPress,
}: {
  step: ResolvedCookingModeStep;
  index: number;
  current: number;
  pager: StepPager;
  onPeekPress: () => void;
}) {
  const intl = useIntl();
  const side = index - current;
  const isCurrent = side === 0;
  const isPeek = Math.abs(side) === 1;
  const peekHeight = useSharedValue(0);
  const viewport = useSharedValue(0);
  const content = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollAt = useScrollOffset(scrollRef);
  // The step's scroll and the column's pan run together; the pan pages only from a scroll edge.
  const scroll = useNativeGesture({ simultaneousWith: pager.pan });
  const pose = useDerivedValue(() =>
    slotPose(index - pager.position.get(), pager.height.get(), peekHeight.get())
  );
  const fullStyle = useAnimatedStyle(() => {
    const { y, scale, fullOpacity } = pose.get();

    return { opacity: fullOpacity, transform: [{ translateY: y }, { scale }] };
  });
  const peekStyle = useAnimatedStyle(() => {
    const { y, scale, peekOpacity } = pose.get();
    const centred = (pager.height.get() - peekHeight.get()) / 2;

    return { opacity: peekOpacity, transform: [{ translateY: centred + y }, { scale }] };
  });

  useAnimatedReaction(
    () =>
      isCurrent ? { at: scrollAt.get(), max: Math.max(0, content.get() - viewport.get()) } : null,
    (edge) => {
      if (!edge) return;
      pager.scrollAt.set(edge.at);
      pager.scrollMax.set(edge.max);
    },
    [isCurrent]
  );

  return (
    <View className="absolute inset-0" style={{ pointerEvents: "box-none" }}>
      <View
        className="absolute inset-x-0 overflow-hidden"
        style={{
          top: PEEK_SLOT,
          bottom: PEEK_SLOT,
          pointerEvents: isCurrent ? "box-none" : "none",
        }}
      >
        <Animated.View
          accessibilityElementsHidden={!isCurrent}
          className="flex-1"
          importantForAccessibility={isCurrent ? "auto" : "no-hide-descendants"}
          style={[{ transformOrigin: "left center" }, fullStyle]}
          testID={isCurrent ? "cook-step" : undefined}
        >
          <GestureDetector gesture={scroll}>
            <Animated.ScrollView
              ref={scrollRef}
              bounces={false}
              contentContainerClassName="grow justify-center"
              scrollEnabled={isCurrent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(_, height) => content.set(height)}
              onLayout={(event) => viewport.set(event.nativeEvent.layout.height)}
            >
              <StepBody step={step} />
            </Animated.ScrollView>
          </GestureDetector>
        </Animated.View>
      </View>
      <Animated.View
        accessibilityElementsHidden={!isPeek}
        className="absolute inset-x-0 top-0"
        importantForAccessibility={isPeek ? "auto" : "no-hide-descendants"}
        style={[
          { transformOrigin: "left center", pointerEvents: isPeek ? "auto" : "none" },
          peekStyle,
        ]}
        onLayout={(event) => peekHeight.set(event.nativeEvent.layout.height)}
      >
        {/* Gesture handler's Pressable hit-tests natively; RN's checks a layout without the pose. */}
        <Pressable
          accessibilityLabel={intl.formatMessage(
            { id: "recipes.cookMode.stepLabel" },
            { number: step.stepNumber }
          )}
          accessibilityRole="button"
          testID={isPeek ? `cook-peek-${side < 0 ? "top" : "bottom"}` : undefined}
          onPress={onPeekPress}
        >
          <PeekBody step={step} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
