import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { useTokenColor } from "@/hooks/use-token-color";

/** A full-width glass capsule of labelled segments; the picked one sits on a solid thumb. */
export function GlassSegmented<Value extends string>({
  segments,
  value,
  testID,
  onChange,
}: {
  segments: readonly {
    value: Value;
    label: string;
    icon?: (color: string | undefined) => ReactNode;
    testID: string;
  }[];
  value: Value;
  testID: string;
  onChange: (value: Value) => void;
}) {
  const foreground = useTokenColor("foreground");
  const muted = useTokenColor("muted");

  return (
    <View className="h-11 flex-row items-center gap-0.5 p-1" testID={testID}>
      <GlassSurface radius={22} />
      {segments.map((segment) => {
        const selected = segment.value === value;
        const color = selected ? foreground : muted;

        return (
          <Pressable
            key={segment.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full ${selected ? "bg-thumb" : ""}`}
            testID={segment.testID}
            onPress={() => onChange(segment.value)}
          >
            {segment.icon?.(color)}
            <Text className="text-[15px] font-medium" style={{ color }}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
