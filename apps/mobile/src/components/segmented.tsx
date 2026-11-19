import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";

/** The kit's one segmented control: a sand track whose picked segment sits on a solid thumb.
 * `standard` is 44 pt tall, `compact` 34; `iconOnly` shrinks it to its icons, the labels then only
 * name each segment to accessibility. A `value` of null picks none. */
export function Segmented<Value extends string>({
  segments,
  value,
  testID,
  size = "standard",
  iconOnly = false,
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
  onChange: (value: Value) => void;
}) {
  const foreground = useTokenColor("foreground");
  const muted = useTokenColor("muted");
  const compact = size === "compact";

  return (
    <View
      className={`bg-sand flex-row items-center gap-0.5 ${compact ? "h-[34px] rounded-[17px] p-[3px]" : "h-11 rounded-[22px] p-1"} ${iconOnly ? "self-start" : ""}`}
      testID={testID}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        const color = selected ? foreground : muted;

        return (
          <Pressable
            key={segment.value}
            accessibilityLabel={segment.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`h-full flex-row items-center justify-center gap-1.5 rounded-full ${iconOnly ? (compact ? "w-11" : "w-12") : "flex-1"} ${selected ? "bg-thumb shadow-sm" : ""}`}
            testID={segment.testID}
            onPress={() => onChange(segment.value)}
          >
            {segment.icon?.(color)}
            {iconOnly ? null : (
              <Text
                className={`${compact ? "text-sm" : "text-[15px]"} ${selected ? "font-semibold" : "font-medium"}`}
                numberOfLines={1}
                style={{ color }}
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
