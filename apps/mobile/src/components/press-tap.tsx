import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { usePressScale } from "@/lib/motion/press-scale";

/** A card that opens on a tap and springs smaller under the finger. `requireToFail` is a gesture
 * (a double tap) the tap waits on. */
export function PressTap({
  onPress,
  requireToFail,
  children,
  ...props
}: Omit<ComponentProps<typeof Animated.View>, "style" | "children"> & {
  onPress: () => void;
  requireToFail?: ReturnType<typeof useTapGesture>;
  children: ReactNode;
}) {
  const { style, press } = usePressScale();
  const tap = useTapGesture({
    runOnJS: true,
    requireToFail,
    onBegin: () => press(true),
    onFinalize: (event) => press(false, !event.canceled),
    onActivate: onPress,
  });

  return (
    <GestureDetector gesture={tap}>
      <Animated.View {...props} style={style}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
