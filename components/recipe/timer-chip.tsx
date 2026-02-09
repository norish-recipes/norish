"use client";

import React from "react";
import { ArrowPathIcon, PauseIcon, PlayIcon, ClockIcon } from "@heroicons/react/16/solid";
import { Chip } from "@heroui/react";

import { useTimerStore } from "@/stores/timers";
import { formatTimerMs } from "@/lib/helpers";
import { useNotificationPermission } from "@/hooks/use-notification-permission";

interface TimerChipProps {
  id: string;
  recipeId: string;
  recipeName?: string;
  initialLabel: string;
  durationMs: number;
  originalText: string;
}

export function TimerChip({
  id,
  recipeId,
  recipeName,
  initialLabel,
  durationMs,
  originalText,
}: TimerChipProps) {
  const timer = useTimerStore((state) => state.timers.find((t) => t.id === id));
  const addTimer = useTimerStore((state) => state.addTimer);
  const startTimer = useTimerStore((state) => state.startTimer);
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const resetTimer = useTimerStore((state) => state.resetTimer);
  const { requestPermission } = useNotificationPermission();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!timer) {
      // Request notification permission on first timer interaction
      requestPermission();
      addTimer(id, recipeId, initialLabel, durationMs, recipeName);
      startTimer(id);
    } else if (timer.status === "running") {
      pauseTimer(id);
    } else if (timer.status === "paused") {
      startTimer(id);
    } else if (timer.status === "completed") {
      resetTimer(id);
    }
  };

  if (!timer) {
    return (
      <Chip
        as="button"
        className="mx-1 translate-y-[1px] pr-1.5 pl-2.5 align-baseline text-base"
        color="default"
        radius="full"
        startContent={<ClockIcon className="h-4 w-4" />}
        variant="bordered"
        onClick={handleClick}
      >
        {originalText}
      </Chip>
    );
  }

  const isCompleted = timer.status === "completed";
  const isRunning = timer.status === "running";

  // Active timer - show as chip
  const icon = isCompleted ? (
    <ArrowPathIcon className="h-3 w-3" />
  ) : isRunning ? (
    <PauseIcon className="h-3 w-3" />
  ) : (
    <PlayIcon className="h-3 w-3" />
  );

  return (
    <Chip
      as="button"
      className="mx-1 translate-y-[1px] pr-1.5 pl-2.5 align-baseline text-base"
      color={isCompleted ? "danger" : isRunning ? "primary" : "warning"}
      radius="full"
      size="md"
      startContent={icon}
      variant="bordered"
      onClick={handleClick}
    >
      {formatTimerMs(timer.remainingMs)}
    </Chip>
  );
}
