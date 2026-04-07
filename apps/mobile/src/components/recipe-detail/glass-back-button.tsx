import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useThemeColor } from "heroui-native";

/**
 * Liquid-glass back button for the recipe detail header.
 * Uses GlassView (iOS 26+ liquid glass effect, falls back to a plain View
 * on earlier versions) and a native SF Symbol chevron.
 */
export function GlassBackButton() {
  const router = useRouter();
  const foregroundColor = useThemeColor("foreground");

  return (
    <Pressable onPress={() => router.back()} hitSlop={8}>
      <SymbolView
        name="chevron.left"
        tintColor={foregroundColor}
        weight="semibold"
        style={styles.symbol}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  symbol: {
    width: 17,
    height: 17,
  },
});
