import React from "react";
import { CalendarStack } from "@/features/calendar/components/calendar-stack";
import { AddAtOnceHost } from "@/features/recipes/components/add-at-once-host";

/** Plan recipe from here follows "after planning" too, so add at once lives above the sheets. */
export default function CalendarLayout() {
  return (
    <AddAtOnceHost>
      <CalendarStack />
    </AddAtOnceHost>
  );
}
