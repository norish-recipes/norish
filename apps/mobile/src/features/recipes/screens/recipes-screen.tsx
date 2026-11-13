import React from "react";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

import type { TodaySectionVisibility } from "@norish/shared/contracts/zod/device-preferences";
import { useTodaysMeals } from "@norish/shared-react/calendar";
import { useDevicePreference, useToday } from "@norish/shared-react/reader";

import { LibraryList } from "../components/library-list";
import { TodaySection } from "../components/today-section";
import { useTodayActions } from "../hooks/use-today-actions";

/** The Recipes tab: Today's slots as the Library's list header, under the large title "Today". */
export function RecipesScreen() {
  const [visibility] = useDevicePreference("todaySectionVisibility");

  return visibility === "hidden" ? (
    <LibraryScreen title="navbar.nav.home" />
  ) : (
    <WithToday visibility={visibility} />
  );
}

function LibraryScreen({ title, header }: { title: string; header?: React.ReactNode }) {
  const intl = useIntl();

  return (
    <>
      <Stack.Screen options={{ title: intl.formatMessage({ id: title }) }} />
      <LibraryList header={header} testID="recipes-screen" />
    </>
  );
}

function WithToday({ visibility }: { visibility: TodaySectionVisibility }) {
  const todayKey = useToday();
  const today = useTodaysMeals(todayKey, visibility);
  const actions = useTodayActions();
  // Planned-only can leave no slot, so the Library then stands alone under its own title.
  const shown = today.isLoading || today.visibleSlots.length > 0;

  return shown ? (
    <LibraryScreen
      header={<TodaySection actions={actions} today={today} />}
      title="calendar.mobile.today"
    />
  ) : (
    <LibraryScreen title="navbar.nav.home" />
  );
}
