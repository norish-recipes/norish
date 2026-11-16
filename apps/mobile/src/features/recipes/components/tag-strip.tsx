import type { ReactNode } from "react";
import type { ScrollView } from "react-native";
import React from "react";
import { GestureDetector, GestureStateManager, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { decayTo } from "@/lib/motion/decay-to";

import { stripIntent } from "../utils/tag-strip-intent";

/** The pan of a sideways tag strip, for `TagStrip` and for the card's swipe to wait on. */
export function useTagStrip() {
  const scrollX = useSharedValue(0);
  const startX = useSharedValue(0);
  const max = useSharedValue(0);
  const width = useSharedValue(0);
  const contentWidth = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const origin = useSharedValue({ x: 0, y: 0 });
  const decided = useSharedValue(false);

  // The strip takes a drag only when it can scroll that way; otherwise it fails at once and the
  // card's swipe, which waits on this gesture, or the list's scroll takes the touch.
  const gesture = usePanGesture({
    manualActivation: true,
    onTouchesDown: (event) => {
      "worklet";
      const touch = event.allTouches[0];

      origin.set({ x: touch?.x ?? 0, y: touch?.y ?? 0 });
      decided.set(false);
    },
    onTouchesMove: (event) => {
      "worklet";
      const touch = event.allTouches[0];

      if (decided.get() || !touch) return;

      const intent = stripIntent(
        touch.x - origin.get().x,
        touch.y - origin.get().y,
        scrollX.get(),
        max.get()
      );

      if (intent === "wait") return;
      decided.set(true);
      if (intent === "scroll") GestureStateManager.activate(event.handlerTag);
      else GestureStateManager.fail(event.handlerTag);
    },
    onActivate: () => {
      "worklet";
      startX.set(scrollX.get());
    },
    onUpdate: (event) => {
      "worklet";
      scrollX.set(Math.min(Math.max(startX.get() - event.translationX, 0), max.get()));
    },
    onDeactivate: (event) => {
      "worklet";
      scrollX.set(
        decayTo(scrollX.get(), {
          velocity: -event.velocityX,
          clamp: [0, max.get()],
          reduceMotion,
        })
      );
    },
  });

  // The extent is the content past the width, whichever of the two is measured last.
  const measure = (set: (value: number) => void) => (value: number) => {
    set(value);
    max.set(Math.max(contentWidth.get() - width.get(), 0));
  };

  return {
    gesture,
    scrollX,
    max,
    setWidth: measure((value) => width.set(value)),
    setContentWidth: measure((value) => contentWidth.set(value)),
  };
}

/** A row of tags that scrolls sideways under `strip`'s gesture, clipped by its parent. */
export function TagStrip({
  strip,
  testID,
  children,
}: {
  strip: ReturnType<typeof useTagStrip>;
  testID: string;
  children: ReactNode;
}) {
  const scroll = useAnimatedRef<ScrollView>();

  useAnimatedReaction(
    () => strip.scrollX.get(),
    (x) => scrollTo(scroll, x, 0, false)
  );

  return (
    <GestureDetector gesture={strip.gesture}>
      <Animated.ScrollView
        ref={scroll}
        horizontal
        className="absolute inset-x-0 bottom-0"
        contentContainerClassName="gap-1.5 p-2"
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        testID={testID}
        onContentSizeChange={strip.setContentWidth}
        onLayout={(event) => strip.setWidth(event.nativeEvent.layout.width)}
      >
        {children}
      </Animated.ScrollView>
    </GestureDetector>
  );
}
