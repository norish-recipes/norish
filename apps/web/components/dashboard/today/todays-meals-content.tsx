"use client";

import { useMemo, useState } from "react";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import MiniRecipes from "@/components/Panel/consumers/mini-recipes";
import TodaysMealsSkeleton from "@/components/skeleton/todays-meals-skeleton";
import { ScrollShadow } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { Slot } from "@norish/shared/contracts";
import { dateKey } from "@norish/shared/lib/helpers";

import TodayMealSlotCard from "./today-meal-slot-card";
import { slotTranslationKeys, TODAY_MEAL_SLOTS } from "./todays-meals-constants";
import { groupTodayItemsBySlot } from "./todays-meals-helpers";

export default function TodaysMealsContent() {
  const locale = useLocale();
  const tCalendar = useTranslations("calendar");
  const tSlots = useTranslations("common.slots");
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const todayDate = useMemo(() => new Date(`${todayKey}T00:00:00`), [todayKey]);
  const { plannedItemsByDate, isLoading } = useCalendarContext();
  const [planningSlot, setPlanningSlot] = useState<Slot | undefined>(undefined);
  const [planningOpen, setPlanningOpen] = useState(false);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(todayDate),
    [locale, todayDate]
  );

  const itemsBySlot = useMemo(
    () => groupTodayItemsBySlot(plannedItemsByDate[todayKey] ?? []),
    [plannedItemsByDate, todayKey]
  );

  const openPlanner = (slot: Slot) => {
    setPlanningSlot(slot);
    setPlanningOpen(true);
  };

  return (
    <section className="flex shrink-0 flex-col gap-4" aria-labelledby="today-meals-heading">
      <div className="min-w-0">
        <h2 id="today-meals-heading" className="text-foreground text-2xl leading-8 font-semibold">
          {tCalendar("mobile.today")}
        </h2>
        <p className="text-muted mt-1 text-sm">{dateLabel}</p>
      </div>

      <ScrollShadow
        hideScrollBar
        className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        orientation="horizontal"
      >
        {isLoading ? (
          <TodaysMealsSkeleton />
        ) : (
          <div className="flex gap-3">
            {TODAY_MEAL_SLOTS.map((slot) => (
              <TodayMealSlotCard
                key={slot}
                items={itemsBySlot[slot]}
                onPlan={openPlanner}
                slot={slot}
                slotLabel={tSlots(slotTranslationKeys[slot])}
              />
            ))}
          </div>
        )}
      </ScrollShadow>

      <MiniRecipes
        date={todayDate}
        open={planningOpen}
        slot={planningSlot}
        onOpenChange={setPlanningOpen}
      />
    </section>
  );
}
