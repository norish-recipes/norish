"use client";

import {
  slotTranslationKeys,
  TODAY_MEAL_SLOTS,
} from "@/components/dashboard/today/todays-meals-constants";
import TodaysMealsSlotChip from "@/components/dashboard/today/todays-meals-slot-chip";
import { Card, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { Slot } from "@norish/shared/contracts";

function TodayMealSlotSkeleton({ slot }: { slot: Slot }) {
  const tSlots = useTranslations("common.slots");

  return (
    <Card className="relative h-[184px] w-[144px] shrink-0 overflow-hidden rounded-2xl p-0 sm:w-[152px]">
      <div className="absolute top-2 left-2 z-20 max-w-[calc(100%-1rem)]">
        <TodaysMealsSlotChip
          className="bg-overlay text-foreground shadow-md"
          slot={slot}
          slotLabel={tSlots(slotTranslationKeys[slot])}
        />
      </div>
      <Skeleton className="h-[132px] w-full rounded-none" />
      <Card.Content className="flex h-[52px] flex-col justify-center gap-1 px-2.5 py-1.5">
        <Skeleton className="h-3.5 w-4/5 rounded-md" />
        <Skeleton className="h-2.5 w-2/3 rounded-md" />
      </Card.Content>
    </Card>
  );
}

/** Every slot, for a reader who always sees them; a planned-only row draws no skeleton. */
export default function TodaysMealsSkeleton() {
  return (
    <div className="flex gap-3">
      {TODAY_MEAL_SLOTS.map((slot) => (
        <TodayMealSlotSkeleton key={slot} slot={slot} />
      ))}
    </div>
  );
}
