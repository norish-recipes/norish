"use client";

import React, { useEffect } from "react";
import { ArrowPathIcon, PauseIcon, PlayIcon } from "@heroicons/react/24/solid";

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
      <button
        type="button"
        onClick={handleClick}
        className="mx-1 inline-flex translate-y-[1px] transform items-center rounded-md bg-orange-100 px-2 py-0.5 align-baseline text-base font-medium text-orange-700 transition-colors hover:bg-orange-200"
      >
        <PlayIcon className="mr-1 h-3 w-3" />
        {originalText}
      </button>
    );
  }

  const isCompleted = timer.status === "completed";
  const isRunning = timer.status === "running";

  let styles = "bg-orange-100 text-orange-700";
  if (isRunning) styles = "bg-orange-600 text-white shadow-sm";
  if (isCompleted) styles = "bg-red-600 text-white animate-pulse";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`mx-1 inline-flex translate-y-[1px] transform items-center rounded-md px-2 py-0.5 align-baseline font-mono text-base font-medium transition-all ${styles}`}
    >
      {isCompleted ? (
        <>
          <ArrowPathIcon className="mr-1 h-3 w-3" />
          DONE
        </>
      ) : (
        <>
          {isRunning ? (
            <PauseIcon className="mr-1 h-3 w-3" />
          ) : (
            <PlayIcon className="mr-1 h-3 w-3" />
          )}
          {formatTime(timer.remainingMs)}
        </>
      )}
    </button>
  );
}
