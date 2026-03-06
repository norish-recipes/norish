import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

/**
 * Liquid-glass back button for the recipe detail header.
 * Uses GlassView (iOS 26+ liquid glass effect, falls back to a plain View
 * on earlier versions) and a native SF Symbol chevron.
 */
export function GlassBackButton() {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.back()} hitSlop={8}>
      <GlassView style={styles.glass} isInteractive>
        <SymbolView
          name="chevron.left"
          tintColor="#ffffff"
          weight="semibold"
          style={styles.symbol}
        />
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbol: {
    width: 17,
    height: 17,
  },
});
