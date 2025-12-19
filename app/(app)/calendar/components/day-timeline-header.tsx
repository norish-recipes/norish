"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/16/solid";

import { MiniRecipes } from "@/components/Panel/consumers";

type Props = {
  date: Date;
  isToday: boolean;
  weekday: string;
  month: string;
  onPanelOpenChange?: (open: boolean) => void;
};

export function DayTimelineHeader({ date, isToday, weekday, month, onPanelOpenChange }: Props) {
  const dayNum = String(date.getDate()).padStart(2, "0");
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      onPanelOpenChange?.(isOpen);
    },
    [onPanelOpenChange]
  );

  return (
    <div className="flex items-center gap-2">
      <div className="w-12 shrink-0 md:w-14">
        <div
          className={
            (isToday ? "text-primary " : "text-foreground ") +
            "font-mono text-3xl leading-none font-semibold tabular-nums md:text-4xl"
          }
        >
          {dayNum}
        </div>
      </div>

      <div className="-ml-1 flex flex-col leading-tight">
        <div className="text-default-700 text-base">{weekday}</div>
        <div className="text-default-500 text-base">{month}</div>
      </div>

      <div className="flex-1" />

      <Button
        isIconOnly
        aria-label="Add"
        className="min-w-0 bg-transparent p-1 shadow-none data-[hover=true]:bg-transparent"
        radius="none"
        size="sm"
        variant="light"
        onPress={() => handleOpenChange(true)}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>

      <MiniRecipes date={date} open={open} onOpenChange={handleOpenChange} />
    </div>
  );
}
