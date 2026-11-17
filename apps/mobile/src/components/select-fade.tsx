import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { useFadeProgress } from "@/lib/motion/fade-to";

/** What a choice looks like at rest and picked: `shape` is shared, `rest` and `picked` are the
 * backgrounds, `tone` the content's two colours and `inset` where the picked background sits. */
export type SelectLook = {
  shape: string;
  rest: string;
  picked: string;
  tone: { rest: string; picked: string };
  inset?: string;
};

/** A choice whose picked look springs in over its resting one. The content is built once with the
 * animated colour it takes: `children(color)` styles an `Animated.Text`. */
export function SelectFade({
  selected,
  look: { shape, rest, picked, tone, inset = "inset-0" },
  children,
}: {
  selected: boolean;
  look: SelectLook;
  children: (color: ComponentProps<typeof Animated.Text>["style"]) => ReactNode;
}) {
  const fade = useFadeProgress(selected ? 1 : 0);
  const background = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(fade.get(), [0, 1], [tone.rest, tone.picked]),
  }));

  return (
    <View className={`${shape} ${rest}`}>
      <Animated.View
        className={`${shape} ${picked} absolute ${inset}`}
        pointerEvents="none"
        style={background}
      />
      {children(color)}
    </View>
  );
}
