import React from "react";
import { useIntl } from "react-intl";

import type { TodaySectionVisibility } from "@norish/shared/contracts/zod/device-preferences";
import { useTodaysMeals } from "@norish/shared-react/calendar";
import { useDevicePreference, useToday } from "@norish/shared-react/reader";

import { LibraryList } from "../components/library-list";
import { TodaySection } from "../components/today-section";

/** The Recipes tab: Today's slots as the Library's list header, under the large title "Recipes". */
export function RecipesScreen() {
  const intl = useIntl();
  const [visibility] = useDevicePreference("todaySectionVisibility");
  const title = intl.formatMessage({ id: "navbar.nav.home" });

  return visibility === "hidden" ? (
    <LibraryList testID="recipes-screen" title={title} />
  ) : (
    <WithToday title={title} visibility={visibility} />
  );
}

function WithToday({ title, visibility }: { title: string; visibility: TodaySectionVisibility }) {
  const todayKey = useToday();
  const today = useTodaysMeals(todayKey, visibility);
  // Planned-only can leave no slot, so the Library then stands alone under its own title.
  const shown = today.isLoading || today.visibleSlots.length > 0;

  return shown ? (
    <LibraryList header={<TodaySection today={today} />} testID="recipes-screen" title={title} />
  ) : (
    <LibraryList testID="recipes-screen" title={title} />
  );
}
