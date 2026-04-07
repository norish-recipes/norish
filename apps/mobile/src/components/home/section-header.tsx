import React from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColor } from "heroui-native";

const SECTION_HEADER_STYLES = {
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    lineHeight: 24,
  },
  action: {
    fontSize: 13,
    fontWeight: "500" as const,
    lineHeight: 18,
  },
};

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const [textColor, accentColor] = useThemeColor(["foreground", "accent"] as const);

  return (
    <View style={SECTION_HEADER_STYLES.container}>
      <Text style={[SECTION_HEADER_STYLES.title, { color: textColor }]}>{title}</Text>
      {actionLabel != null ? (
        <Pressable onPress={onAction}>
          <Text style={[SECTION_HEADER_STYLES.action, { color: accentColor }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
