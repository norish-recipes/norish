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

const TABULAR = { fontVariant: ["tabular-nums"] } as const;

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
        style={TABULAR}
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
        style={TABULAR}
      >
        {character}
      </Animated.Text>
    </View>
  );
}

/** A number whose characters roll like an odometer: unchanged ones stay still, the rest travel the
 * way the value moved. Only the part that changes belongs in here, not the word beside it. */
export function RollingText({
  value,
  rising,
  slots,
  word = false,
  className = "",
}: {
  value: string;
  /** Whether the value moved forward, so the characters roll up. */
  rising: boolean;
  /** Slots to render whatever the value's length, so none is made or lost mid-roll. */
  slots?: number;
  /** A word grows at its end and keeps its real spaces; a number grows at its start. */
  word?: boolean;
  /** The text's classes: its size, weight and colour. */
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <Text className={className} style={TABULAR}>
        {value}
      </Text>
    );
  }

  const characters = toSlots(value, slots, word ? "left" : "right");

  return (
    // One label for the row: read per character it would say "five, zero".
    <View accessible accessibilityLabel={value} className="flex-row">
      <LayoutAnimationConfig skipEntering>
        {characters.map((character, index) => (
          <Slot
            // A slot is its place from where the value grows, so a character rolls in place.
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a slot is its place in the row
            key={word ? index : characters.length - index}
            // A figure space is a digit wide, so an empty number slot holds the row's width.
            character={character === " " && !word ? "\u2007" : character}
            className={className}
            rising={rising}
          />
        ))}
      </LayoutAnimationConfig>
    </View>
  );
}
