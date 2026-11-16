import type { ReactNode } from "react";
import type { ScrollView } from "react-native";
import React from "react";
import { GestureDetector, GestureStateManager, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withDecay,
} from "react-native-reanimated";

import { stripIntent } from "../utils/tag-strip-intent";

/** The pan of a sideways tag strip, for `TagStrip` and for the card's swipe to wait on. */
export function useTagStrip() {
  const scrollX = useSharedValue(0);
  const startX = useSharedValue(0);
  const max = useSharedValue(0);
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
      scrollX.set(withDecay({ velocity: -event.velocityX, clamp: [0, max.get()] }));
    },
  });

  return { gesture, scrollX, max };
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
  const width = useSharedValue(0);

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
        onContentSizeChange={(contentWidth) =>
          strip.max.set(Math.max(contentWidth - width.get(), 0))
        }
        onLayout={(event) => width.set(event.nativeEvent.layout.width)}
      >
        {children}
      </Animated.ScrollView>
    </GestureDetector>
  );
}
