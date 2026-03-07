import Ionicons from '@expo/vector-icons/Ionicons';
import { Chip } from 'heroui-native';
import React from 'react';

// ─── Props ───────────────────────────────────────────────────────────────────

type TimerChipInlineProps = {
  /** Display text inside the chip (e.g. "15 minutes") */
  text: string;
  /** Called when the chip is pressed to start a timer */
  onPress?: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * A timer chip displayed inline within recipe step text.
 *
 * Rendered as a HeroUI Chip inside a <Text> tree. React Native on iOS
 * treats nested Views as inline-block elements, so the chip flows
 * naturally with surrounding text.
 */
export function TimerChipInline({ text, onPress }: TimerChipInlineProps) {
  return (
    <Chip
      variant="primary"
      color="accent"
      size="sm"
      onPress={onPress}
    >
      <Chip.Label>
        <Ionicons name="timer-outline" size={11} /> {text}
      </Chip.Label>
    </Chip>
  );
}
