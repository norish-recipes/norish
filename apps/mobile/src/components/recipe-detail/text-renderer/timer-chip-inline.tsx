import React, { useCallback } from "react";
import { useTimerStore } from "@/stores/timers";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Chip } from "heroui-native";

import { formatTimerMs } from "@norish/shared/lib/helpers";

// ─── Props ───────────────────────────────────────────────────────────────────

type TimerChipInlineProps = {
  /** Display text inside the chip (e.g. "15 minutes") */
  text: string;
  /** Unique timer ID for the store */
  timerId?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Human-friendly label for the timer */
  label?: string;
  /** Recipe ID this timer belongs to */
  recipeId?: string;
  /** Recipe name for multi-recipe context */
  recipeName?: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * A timer chip displayed inline within recipe step text.
 *
 * When pressed it adds a timer to the global store and starts it immediately.
 * If the timer already exists, pressing toggles play/pause (or resets when
 * completed). While a timer is active the chip shows a live countdown and
 * changes colour by status.
 */
export function TimerChipInline({
  text,
  timerId,
  durationMs,
  label,
  recipeId,
  recipeName,
}: TimerChipInlineProps) {
  const addTimer = useTimerStore((s) => s.addTimer);
  const startTimer = useTimerStore((s) => s.startTimer);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resetTimer = useTimerStore((s) => s.resetTimer);
  const timers = useTimerStore((s) => s.timers);

  const existingTimer = timerId ? timers.find((t) => t.id === timerId) : null;
  const isRunning = existingTimer?.status === "running";
  const isPaused = existingTimer?.status === "paused";
  const isCompleted = existingTimer?.status === "completed";

  const handlePress = useCallback(() => {
    if (!timerId || !durationMs) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (existingTimer) {
      if (isCompleted) {
        // Completed → reset back to original duration
        resetTimer(timerId);
      } else if (isRunning) {
        pauseTimer(timerId);
      } else {
        startTimer(timerId);
      }
    } else {
      // Add and auto-start
      addTimer(timerId, recipeId ?? "unknown", label ?? text, durationMs, recipeName);
      startTimer(timerId);
    }
  }, [
    timerId,
    durationMs,
    existingTimer,
    isRunning,
    isCompleted,
    addTimer,
    startTimer,
    pauseTimer,
    resetTimer,
    recipeId,
    label,
    text,
    recipeName,
  ]);

  // ── Choose icon by status ──────────────────────────────────────────────────

  const iconName: React.ComponentProps<typeof Ionicons>["name"] = isCompleted
    ? "refresh"
    : isRunning
      ? "pause"
      : isPaused
        ? "play"
        : "timer-outline";

  // ── Choose chip colour by status ───────────────────────────────────────────

  const chipColor: React.ComponentProps<typeof Chip>["color"] = isCompleted
    ? "danger"
    : isRunning
      ? "accent"
      : isPaused
        ? "warning"
        : "default";

  // ── Display text: live countdown when active, original text otherwise ──────

  const displayText = existingTimer ? formatTimerMs(existingTimer.remainingMs) : text;

  return (
    <Chip variant="primary" color={chipColor} size="sm" onPress={handlePress}>
      <Chip.Label>
        <Ionicons name={iconName} size={11} /> {displayText}
      </Chip.Label>
    </Chip>
  );
}
