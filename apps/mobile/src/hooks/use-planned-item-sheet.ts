import type { HeaderConfirm } from "@/components/modal-header";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarMutations, usePlannedItemDraft } from "@norish/shared-react/calendar";

/** A planned item's draft on a sheet: Save writes it and closes, and `fields` wires `MoveFields`. */
export function usePlannedItemSheet(item: PlannedItemFromQuery) {
  const intl = useIntl();
  const router = useRouter();
  const { saveItem } = useCalendarMutations();
  const { draft, changes, setTitle, setDate, setSlot, save } = usePlannedItemDraft(item, saveItem);
  // Only the call that wrote goes back: a second Save or Return would pop the screen beneath.
  const saveAndClose = () => {
    if (save()) router.back();
  };
  const confirm: HeaderConfirm = {
    label: intl.formatMessage({ id: "common.actions.save" }),
    disabled: !changes,
    onPress: saveAndClose,
  };

  return {
    draft,
    changes,
    setTitle,
    saveAndClose,
    confirm,
    fields: { date: draft.date, slot: draft.slot, onDateChange: setDate, onSlotChange: setSlot },
  };
}
