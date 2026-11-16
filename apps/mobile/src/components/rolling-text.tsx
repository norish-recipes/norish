import React from "react";
import { Text, View } from "react-native";
import Animated, {
  LayoutAnimationConfig,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SPRING } from "@/lib/motion/spring";

import { toSlots } from "@norish/shared/lib/rolling-slots";

/** A layout animation moving a character from one place and opacity to another, on the app's spring. */
function slide(fromY: number, toY: number, fromOpacity: number, toOpacity: number) {
  "worklet";

  return {
    initialValues: { transform: [{ translateY: fromY }], opacity: fromOpacity },
    animations: {
      transform: [{ translateY: withSpring(toY, SPRING) }],
      opacity: withSpring(toOpacity, { ...SPRING, overshootClamping: true }),
    },
  };
}

/** One character's place: a changed character rolls out and the new one rolls in. */
function Slot({
  character,
  rising,
  className,
}: {
  character: string;
  rising: boolean;
  className: string;
}) {
  const height = useSharedValue(0);

  return (
    <View className="overflow-hidden">
      {/* In flow, unseen: sizes the slot for the rolling characters on top. */}
      <Text
        className={`${className} opacity-0`}
        style={{ fontVariant: ["tabular-nums"] }}
        onLayout={(event) => height.set(event.nativeEvent.layout.height)}
      >
        {character}
      </Text>
      <Animated.Text
        key={character}
        className={`${className} absolute top-0 left-0`}
        entering={() => {
          "worklet";

          return slide(rising ? height.get() : -height.get(), 0, 0, 1);
        }}
        exiting={() => {
          "worklet";

          return slide(0, rising ? -height.get() : height.get(), 1, 0);
        }}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {character}
      </Animated.Text>
    </View>
  );
}

/** Text whose characters roll like an odometer: unchanged ones stay still, the rest travel the way
 * the value moved. Only the part that changes belongs in here, not the word beside it. */
export function RollingText({
  value,
  rising,
  keyFrom = "right",
  slots,
  className = "",
}: {
  value: string;
  /** Whether the value moved forward, so the characters roll up. */
  rising: boolean;
  /** The end the slots are keyed from: a number grows leftwards, a word rightwards. */
  keyFrom?: "left" | "right";
  /** Slots to render whatever the value's length, so none is made or lost mid-roll. */
  slots?: number;
  /** The text's classes: its size, weight and colour. */
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <Text className={className} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    );
  }

  const characters = toSlots(value, slots, keyFrom);

  return (
    // One label for the row: read per character it would say "five, zero".
    <View accessible accessibilityLabel={value} className="flex-row">
      <LayoutAnimationConfig skipEntering>
        {characters.map((character, index) => (
          <Slot
            // A slot is its place from the side the value grows on, so a character rolls in place.
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a slot is its place in the row
            key={keyFrom === "right" ? characters.length - index : index}
            // A figure space is a digit wide, so an empty slot holds the row's width.
            character={character === " " ? "\u2007" : character}
            className={className}
            rising={rising}
          />
        ))}
      </LayoutAnimationConfig>
    </View>
  );
}
