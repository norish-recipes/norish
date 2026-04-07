import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";

type NoImagePlaceholderProps = {
  variant?: "card" | "header";
};

const ICON_SIZE: Record<string, number> = {
  card: 32,
  header: 48,
};

/**
 * Reusable "No image" placeholder that renders a centred image icon
 * over a neutral surface background. Used in recipe cards and the media header
 * when an image URL is missing or fails to load.
 */
export function NoImagePlaceholder({ variant = "card" }: NoImagePlaceholderProps) {
  const [bgColor, iconColor] = useThemeColor(["surface-tertiary", "muted"] as const);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Ionicons
        name="image-outline"
        size={ICON_SIZE[variant] ?? ICON_SIZE.card}
        color={iconColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
