import type { ComponentProps } from "react";
import React from "react";
import { Pressable } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "@/lib/motion/press-scale";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that springs smaller under the finger. */
export function PressableScale({
  onPress,
  onPressIn,
  onPressOut,
  ...props
}: Omit<ComponentProps<typeof Pressable>, "style">) {
  const { style, press } = usePressScale();

  return (
    <AnimatedPressable
      {...props}
      style={style}
      onPress={(event) => {
        press(false, true);
        onPress?.(event);
      }}
      onPressIn={(event) => {
        press(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press(false);
        onPressOut?.(event);
      }}
    />
  );
}
