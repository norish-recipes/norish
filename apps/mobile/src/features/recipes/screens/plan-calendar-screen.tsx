import React, { useState } from "react";
import { PlanDayList } from "@/components/plan-block";
import { Sheet } from "@/components/sheet";
import { useLocalSearchParams } from "expo-router";
import { useIntl } from "react-intl";

import type { Slot } from "@norish/shared/contracts";
import { usePlanOnDay } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";

import { usePlanExit } from "../hooks/use-plan-exit";

/**
 * Plan a recipe from the recipe: the plan block (day, slot, then every day's card), where Plan or
 * a day's "+" puts the recipe on the picked slot. The shared mutations queue in the Outbox offline.
 */
export function PlanCalendarScreen() {
  const intl = useIntl();
  const today = useToday();
  const { recipeId, name } = useLocalSearchParams<{ recipeId: string; name?: string }>();
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot>("Dinner");
  const exit = usePlanExit();
  const planOnDay = usePlanOnDay({ recipe: { id: recipeId }, close: exit });

  return (
    <Sheet
      confirm={{
        label: intl.formatMessage({ id: "recipes.actions.plan" }),
        onPress: () => planOnDay(date, slot),
      }}
      name="plan"
      subtitle={name ?? ""}
      title={intl.formatMessage({ id: "calendar.panel.planThisRecipe" })}
    >
      <PlanDayList
        date={date}
        name={name ?? ""}
        slot={slot}
        testID="plan"
        onAdd={(key) => planOnDay(key, slot)}
        onDateChange={setDate}
        onSlotChange={setSlot}
      />
    </Sheet>
  );
}
