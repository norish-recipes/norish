import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useFadeTo } from "@/lib/motion/fade-to";

/** A choice whose picked look springs in over its resting one: `children(true)` is drawn on top and
 * faded with `selected`. `className` is the shape both looks share, `inset` where the top look sits. */
export function SelectFade({
  selected,
  className,
  restClassName,
  pickedClassName,
  inset = "inset-0",
  children,
}: {
  selected: boolean;
  className: string;
  restClassName: string;
  pickedClassName: string;
  inset?: string;
  children: (picked: boolean) => ReactNode;
}) {
  const fade = useFadeTo(selected ? 1 : 0);

  return (
    <View className={`${className} ${restClassName}`}>
      {children(false)}
      <Animated.View
        accessibilityElementsHidden
        className={`${className} ${pickedClassName} absolute ${inset}`}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={fade}
      >
        {children(true)}
      </Animated.View>
    </View>
  );
}
