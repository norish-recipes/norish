import React from "react";
import { useWindowDimensions } from "react-native";
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { ServerImage } from "@/components/server-image";
import { SPRING } from "@/lib/motion/spring";

import { clampOffset } from "../utils/zoom-offset";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

/** A picture that pinches up to 4x, pans while zoomed and zooms by a double tap. `onZoomed` tells
 * the viewer whether it is zoomed, so the pager and the dismiss drag stand aside. */
export function ZoomableImage({
  path,
  label,
  zoomed,
  onZoomed,
}: {
  path: string;
  label: string;
  zoomed: boolean;
  onZoomed: (zoomed: boolean) => void;
}) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const settle = (to: number, toX: number, toY: number) => {
    "worklet";
    scale.set(reduceMotion ? to : withSpring(to, SPRING));
    x.set(reduceMotion ? toX : withSpring(toX, SPRING));
    y.set(reduceMotion ? toY : withSpring(toY, SPRING));
    startScale.set(to);
    startX.set(toX);
    startY.set(toY);
    scheduleOnRN(onZoomed, to > 1);
  };

  const pinch = usePinchGesture({
    onUpdate: (event) => {
      "worklet";
      const next = Math.min(MAX_SCALE, Math.max(0.6, startScale.get() * event.scale));

      scale.set(next);
      x.set(clampOffset(x.get(), width, next));
      y.set(clampOffset(y.get(), height, next));
    },
    onDeactivate: () => {
      "worklet";
      if (scale.get() <= 1.05) settle(1, 0, 0);
      else {
        startScale.set(scale.get());
        startX.set(x.get());
        startY.set(y.get());
        scheduleOnRN(onZoomed, true);
      }
    },
  });
  const pan = usePanGesture({
    enabled: zoomed,
    onActivate: () => {
      "worklet";
      startX.set(x.get());
      startY.set(y.get());
    },
    onUpdate: (event) => {
      "worklet";
      x.set(clampOffset(startX.get() + event.translationX, width, scale.get()));
      y.set(clampOffset(startY.get() + event.translationY, height, scale.get()));
    },
  });
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      "worklet";
      if (scale.get() > 1) settle(1, 0, 0);
      else settle(DOUBLE_TAP_SCALE, 0, 0);
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]}>
        <ServerImage
          accessibilityLabel={label}
          contentFit="contain"
          path={path}
          style={{ width, height }}
        />
      </Animated.View>
    </GestureDetector>
  );
}
