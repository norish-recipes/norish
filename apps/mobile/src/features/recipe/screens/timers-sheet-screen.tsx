import React from "react";
import { Sheet, SheetScrollView } from "@/components/sheet";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { TimerRows } from "../components/timer-list";

/** The capsule's sheet: every Recipe Timer on the device; it closes when the last one goes. */
export function TimersSheetScreen() {
  const intl = useIntl();
  const router = useRouter();

  return (
    <Sheet name="timers" title={intl.formatMessage({ id: "recipes.cookMode.timers" })}>
      <SheetScrollView inset={false}>
        <TimerRows onEmpty={() => router.back()} />
      </SheetScrollView>
    </Sheet>
  );
}
