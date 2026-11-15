import React from "react";
import { CalendarStack } from "@/features/calendar/components/calendar-stack";
import { AddAtOnceHost } from "@/features/recipes/components/add-at-once-host";
import { TAB_ROUTES } from "@/lib/tab-routes";

/** Plan recipe here follows "after planning" too: add at once above the sheets, this stack's Add to groceries. */
export default function CalendarLayout() {
  return (
    <AddAtOnceHost addToGroceries={TAB_ROUTES.calendar.addToGroceries}>
      <CalendarStack />
    </AddAtOnceHost>
  );
}
