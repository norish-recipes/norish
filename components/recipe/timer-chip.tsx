"use client";

import React, { useEffect } from "react";
import { ArrowPathIcon, PauseIcon, PlayIcon, ClockIcon } from "@heroicons/react/16/solid";
import { Link, Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useTimerStore } from "@/stores/timers";

interface TimerChipProps {
  id: string;
  recipeId: string;
  recipeName?: string;
  initialLabel: string;
  durationMs: number;
  originalText: string;
}

function formatTime(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TimerChip({
  id,
  recipeId,
  recipeName,
  initialLabel,
  durationMs,
  originalText,
}: TimerChipProps) {
  const t = useTranslations("common");
  const timer = useTimerStore((state) => state.timers.find((t) => t.id === id));
  const addTimer = useTimerStore((state) => state.addTimer);
  const startTimer = useTimerStore((state) => state.startTimer);
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const resetTimer = useTimerStore((state) => state.resetTimer);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!timer) {
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
        onClick={handleClick}
        startContent={<ClockIcon className="h-4 w-4" />}
        color="default"
        radius="full"
        variant="bordered"
        className="mx-1 text-base translate-y-[1px] align-baseline pl-2.5 pr-1.5 font-lg"
      >
        {originalText}
      </Chip>
    );
  }

  const isCompleted = timer.status === "completed";
  const isRunning = timer.status === "running";

  if (isCompleted) {
    return (
      <Chip
        as="button"
        onClick={handleClick}
        startContent={<ArrowPathIcon className="h-3 w-3" />}
        color="danger"
        radius="full"
        size="md"
        variant="flat"
        className="mx-1 text-base align-baseline pl-2.5 pr-1 font-lg"
      >
        {t("timer.done")}
      </Chip>
    );
  }

  return (
    <Chip
      as="button"
      onClick={handleClick}
      startContent={isRunning ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
      color="primary"
      radius="full"
      size="md"
      variant={isRunning ? "bordered" : "faded"}
      className="mx-1 text-base translate-y-[-1px] align-baseline pl-2.5 pr-1.5 font-lg"
    >
      {formatTime(timer.remainingMs)}
    </Chip>
  );
}
