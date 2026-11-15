import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import { usePlatform } from "../platform/platform";
import { buildPlannedItemSubtitle, getPlannedItemTitle } from "./todays-meals";

/** A planned item's title and subtitle in the app's language. */
export function usePlannedItemText() {
  const { toast } = usePlatform();

  return (item: PlannedItemFromQuery | undefined) => ({
    title: getPlannedItemTitle(item, toast.translate("calendar.timeline.untitled")),
    subtitle: buildPlannedItemSubtitle(item, {
      note: toast.translate("calendar.timeline.note"),
      serving: toast.translate("calendar.timeline.serving"),
      servings: toast.translate("calendar.timeline.servings"),
    }),
  });
}
