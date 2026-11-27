import type { ReactNode } from "react";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { sharedLabelScale, STANDARD_INSET } from "@/components/segmented-scale";
import { useTokenColor } from "@/hooks/use-token-color";
import { springTo } from "@/lib/motion/spring";

type Box = { x: number; y: number; width: number; height: number };

/** A tab list's roles: iOS gives `tablist` and `tab` no trait, and speaks a tab bar's buttons as tabs. */
const tabRoles = () =>
  Platform.OS === "ios"
    ? ({ list: "tabbar", tab: "button" } as const)
    : ({ list: "tablist", tab: "tab" } as const);

/** The kit's segmented control: a sand track, the pick on a solid thumb that slides to a new pick.
 * 44 pt tall, 34 `compact`; `iconOnly` leaves the labels to accessibility. No `value` picks none.
 * `tabsLabel` makes it a tab list of that name, for a control that switches views; without it
 * it is a radio group, for one that picks a value. */
export function Segmented<Value extends string>({
  segments,
  value,
  testID,
  size = "standard",
  iconOnly = false,
  tabsLabel,
  onChange,
}: {
  segments: readonly {
    value: Value;
    label: string;
    icon?: (color: string | undefined) => ReactNode;
    testID: string;
  }[];
  value: Value | null;
  testID: string;
  size?: "standard" | "compact";
  iconOnly?: boolean;
  tabsLabel?: string;
  onChange: (value: Value) => void;
}) {
  const foreground = useTokenColor("foreground");
  const muted = useTokenColor("muted");
  const compact = size === "compact";
  const roles = tabsLabel ? tabRoles() : ({ list: "radiogroup", tab: "radio" } as const);
  const reduceMotion = useReducedMotion();
  // Each segment's frame in the track, so the thumb can travel between them.
  const [boxes, setBoxes] = useState<Partial<Record<Value, Box>>>({});
  const box = value === null ? undefined : boxes[value];
  const left = useSharedValue(0);
  const width = useSharedValue(0);
  const placed = useSharedValue(false);
  // Until the thumb is placed, after the segments' first layout, the pick is filled in place.
  const [thumbShown, setThumbShown] = useState(false);
  const thumbStyle = useAnimatedStyle(() => ({ left: left.get(), width: width.get() }));
  // Even segments share one label size: the largest at which every label fits in semibold.
  const evenLabels = !compact && !iconOnly;
  const [natural, setNatural] = useState<Partial<Record<Value, number>>>({});
  const [labels, setLabels] = useState<Partial<Record<Value, { x: number; width: number }>>>({});
  const fit = evenLabels ? sharedLabelScale(segments, natural, labels, boxes) : 1;
  const fontSize = Math.floor(Math.max(fit, 0.8) * (compact ? 13 : 15) * 2) / 2;

  useEffect(() => {
    if (!box) return;
    // The first pick lands in place; later ones slide there.
    const jump = !placed.get() || reduceMotion;

    left.set(jump ? box.x : springTo(box.x));
    width.set(jump ? box.width : springTo(box.width));
    placed.set(true);
    setThumbShown(true);
  }, [box, reduceMotion, left, width, placed]);

  return (
    <View
      accessibilityLabel={tabsLabel}
      accessibilityRole={roles.list}
      className={`bg-sand border-stroke flex-row items-center gap-0.5 ${compact ? "h-[34px] rounded-[17px] p-[3px]" : "h-11 rounded-[22px] p-1"} border-[0.5px] ${iconOnly ? "self-start" : ""}`}
      testID={testID}
    >
      {box && thumbShown ? (
        <Animated.View
          className="bg-thumb absolute rounded-full shadow-sm"
          pointerEvents="none"
          style={[{ top: box.y, height: box.height }, thumbStyle]}
        />
      ) : null}
      {evenLabels ? (
        <View aria-hidden className="absolute w-[999px] items-start opacity-0" pointerEvents="none">
          {segments.map((segment) => (
            <Text
              key={segment.value}
              className="font-semibold"
              numberOfLines={1}
              style={{ fontSize: 15 }}
              onLayout={({ nativeEvent: { layout } }) =>
                setNatural((all) => ({ ...all, [segment.value]: layout.width }))
              }
            >
              {segment.label}
            </Text>
          ))}
        </View>
      ) : null}
      {segments.map((segment) => {
        const selected = segment.value === value;
        const color = selected ? foreground : muted;

        return (
          <Pressable
            key={segment.value}
            accessibilityLabel={segment.label}
            accessibilityRole={roles.tab}
            accessibilityState={tabsLabel ? { selected } : { checked: selected }}
            className={`h-full flex-row items-center justify-center gap-1.5 rounded-full ${iconOnly ? (compact ? "w-[34px]" : "w-11") : compact ? "flex-none px-[13px]" : "flex-1"} ${selected && !thumbShown ? "bg-thumb shadow-sm" : ""}`}
            testID={segment.testID}
            onLayout={({ nativeEvent: { layout } }) =>
              setBoxes((all) => ({ ...all, [segment.value]: layout }))
            }
            style={evenLabels ? { paddingHorizontal: STANDARD_INSET } : undefined}
            onPress={() => onChange(segment.value)}
          >
            {segment.icon?.(color)}
            {iconOnly ? null : (
              <Text
                className={`shrink ${selected ? "font-semibold" : "font-medium"}`}
                numberOfLines={1}
                style={{ color, fontSize }}
                onLayout={({ nativeEvent: { layout } }) =>
                  setLabels((all) => ({ ...all, [segment.value]: layout }))
                }
              >
                {segment.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
