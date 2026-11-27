import type { StarMotion, StarTap } from "@/lib/motion/star-motion";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
} from "react-native-reanimated";
import { Ionicons } from "@/components/icon";
import { popAfter } from "@/lib/motion/pop-on-change";
import { settleTo } from "@/lib/motion/settle-to";
import { liveTap, starMotion } from "@/lib/motion/star-motion";
import { useThemeColor } from "heroui-native";

const STAR_SIZE = 34;

/** One star: the filled glyph over the outline. A tap's change fades it, and a fill swells it, after
 * its `motion` delay; with no `motion` (a value from the server) it is shown as it is. */
function Star({ filled, motion }: { filled: boolean; motion: StarMotion | null }) {
  const reduceMotion = useReducedMotion();
  const [star, muted] = useThemeColor(["warning", "muted"] as const);
  const fill = useSharedValue(filled ? 1 : 0);
  const scale = useSharedValue(1);
  const seenRef = useRef(filled);
  const filledStyle = useAnimatedStyle(() => ({ opacity: fill.get() }));
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  useEffect(() => {
    if (seenRef.current === filled) return;
    seenRef.current = filled;
    if (!motion) {
      fill.set(filled ? 1 : 0);

      return;
    }
    const delay = reduceMotion ? 0 : motion.delay;

    fill.set(withDelay(delay, settleTo(filled ? 1 : 0, { reduceMotion, overshootClamping: true })));
    if (motion.pop) scale.set(popAfter(delay, reduceMotion));
  }, [filled, motion, reduceMotion, fill, scale]);

  return (
    <Animated.View style={pop}>
      <Ionicons color={muted} name="star-outline" size={STAR_SIZE} />
      <Animated.View className="absolute inset-0" style={filledStyle}>
        <Ionicons color={star} name="star" size={STAR_SIZE} />
      </Animated.View>
    </Animated.View>
  );
}

/** Five stars picking `value`; tapping the picked star clears it. With no value the stars show
 * `fallback` rounded. Star n's testID is `${testID}-n`, and `labelFor(n)` what VoiceOver reads. */
export function StarRating({
  value,
  fallback = null,
  testID,
  labelFor,
  onChange,
}: {
  value: number | null;
  fallback?: number | null;
  testID: string;
  labelFor: (star: number) => string;
  onChange: (next: number | null) => void;
}) {
  const shownFor = (picked: number | null) => Math.round(picked ?? fallback ?? 0);
  const shown = shownFor(value);
  // The last tap: only its own change animates, once.
  const [tap, setTap] = useState<StarTap | null>(null);
  const live = liveTap(tap, shown);

  if (live !== tap) setTap(live);

  return (
    <View accessibilityRole="radiogroup" className="flex-row gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          accessibilityLabel={labelFor(star)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === star }}
          hitSlop={4}
          testID={`${testID}-${star}`}
          onPress={() => {
            const next = value === star ? null : star;

            setTap({ from: shown, to: shownFor(next), reached: false });
            onChange(next);
          }}
        >
          <Star
            filled={star <= shown}
            motion={live?.reached ? starMotion(star, live.from, live.to) : null}
          />
        </Pressable>
      ))}
    </View>
  );
}
