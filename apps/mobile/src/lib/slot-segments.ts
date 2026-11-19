import { useIntl } from "react-intl";

import type { Slot } from "@norish/shared/contracts";
import { slotTranslationKeys, TODAY_MEAL_SLOTS } from "@norish/shared-react/calendar/todays-meals";

/** A meal slot from a tab's value, Dinner for anything else. */
export const asSlot = (value: string | undefined): Slot =>
  TODAY_MEAL_SLOTS.find((slot) => slot === value) ?? "Dinner";

/** The four meal slots as `Segmented` segments; each testID is `${testID}-${slot}`. */
export function useSlotSegments(testID: string) {
  const intl = useIntl();

  return TODAY_MEAL_SLOTS.map((slot) => ({
    value: slot,
    label: intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` }),
    testID: `${testID}-${slot}`,
  }));
}
