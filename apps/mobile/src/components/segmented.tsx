import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";

/** The kit's segmented control: a sand track, the picked segment on a solid thumb. `standard` is
 * 44 pt tall, `compact` 34; `iconOnly` drops the labels to accessibility. No `value` picks none. */
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
      className={`bg-sand border-stroke flex-row items-center gap-0.5 ${compact ? "h-[34px] rounded-[17px] p-[3px]" : "h-11 rounded-[22px] p-1"} border-[0.5px] ${iconOnly ? "self-start" : ""}`}
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
            className={`h-full flex-row items-center justify-center gap-1.5 rounded-full ${iconOnly ? (compact ? "w-[34px]" : "w-11") : compact ? "flex-none px-[13px]" : "flex-1"} ${selected ? "bg-thumb shadow-sm" : ""}`}
            testID={segment.testID}
            onPress={() => onChange(segment.value)}
          >
            {segment.icon?.(color)}
            {iconOnly ? null : (
              <Text
                className={`${compact ? "text-[13px]" : "text-[15px]"} ${selected ? "font-semibold" : "font-medium"}`}
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
