"use client";

import { MealIcon } from "@/lib/meal-icon";
import { Chip } from "@heroui/react";

import type { Slot } from "@norish/shared/contracts";

type TodaysMealsSlotChipProps = {
  slot: Slot;
  slotLabel: string;
  className?: string;
};

export default function TodaysMealsSlotChip({
  slot,
  slotLabel,
  className,
}: TodaysMealsSlotChipProps) {
  return (
    <Chip
      className={`inline-flex w-fit max-w-full min-w-0 shrink-0 justify-start ${className ?? ""}`}
      size="sm"
      variant="soft"
    >
      <MealIcon className="h-3.5 w-3.5 shrink-0" slot={slot} />
      <Chip.Label className="min-w-0 truncate">{slotLabel}</Chip.Label>
    </Chip>
  );
}
