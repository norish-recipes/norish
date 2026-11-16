import type { ComponentProps } from "react";
import React from "react";
import { Pressable } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "@/lib/motion/press-scale";

/** A Pressable that springs smaller under the finger. `className` styles the scaling surface. */
export function PressableScale({
  className,
  children,
  onPressIn,
  onPressOut,
  ...props
}: Omit<ComponentProps<typeof Pressable>, "style" | "children"> & {
  className?: string;
  children: React.ReactNode;
}) {
  const { style, press } = usePressScale();

  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        press(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press(false);
        onPressOut?.(event);
      }}
    >
      <Animated.View className={className} style={style}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
