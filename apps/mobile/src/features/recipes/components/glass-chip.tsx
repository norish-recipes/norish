import React from "react";
import { View } from "react-native";
import { Host, HStack, Image, Text } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  glassEffect,
  lineLimit,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { useThemeColor } from "heroui-native";

/** A native glass pill over a photo, 28 pt tall as the board draws it; the position comes from `className`. */
export function GlassChip({
  label,
  systemName,
  semibold,
  className,
}: {
  label: string;
  systemName?: React.ComponentProps<typeof Image>["systemName"];
  semibold?: boolean;
  className: string;
}) {
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <View className={className} pointerEvents="none">
      <Host matchContents>
        <HStack
          modifiers={[
            padding({ leading: systemName ? 8 : 10, trailing: 10 }),
            frame({ height: 28 }),
            glassEffect({ glass: { variant: "regular" }, shape: "capsule" }),
          ]}
          spacing={5}
        >
          {systemName ? <Image color={foreground} size={14} systemName={systemName} /> : null}
          <Text
            modifiers={[
              font({ family: semibold ? "Inter-SemiBold" : "Inter-Medium", size: 13 }),
              foregroundStyle(foreground),
              lineLimit(1),
            ]}
          >
            {label}
          </Text>
        </HStack>
      </Host>
    </View>
  );
}
