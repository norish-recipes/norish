import { OnTheListMark } from "@/components/ingredients/on-the-list-mark";
import { IconActionButton } from "@/components/shared/action-button";
import { showActionToast } from "@/lib/ui/action-toast";
import { ShoppingCartIcon } from "@heroicons/react/16/solid";
import { useLocale, useTranslations } from "next-intl";

import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { usePutOnTheList as usePutOnTheListShared } from "@norish/shared-react/groceries";

/** A kept food, as much of it as putting it on the list needs. */
type KeptFood = { name: string; localeNames?: LocaleNames };

/** Puts a kept food on the list and tells the reader, with an Undo that deletes the grocery. */
export function usePutOnTheList(): (food: KeptFood) => void {
  const t = useTranslations("groceries.pantry");
  const put = usePutOnTheListShared(useLocale());

  return (food) => {
    const { name, undo } = put(food);

    showActionToast(t("putOnTheListToast", { name }), {
      variant: "success",
      action: { label: t("undo"), onPress: undo },
    });
  };
}

/**
 * The end of a kept food's row: _On the list_ while a grocery of that same
 * food is still to buy, else the one press that puts it there.
 */
export function PutOnTheList({ onTheList, onPut }: { onTheList: boolean; onPut: () => void }) {
  const t = useTranslations("groceries.pantry");

  if (onTheList) return <OnTheListMark />;

  return (
    <IconActionButton
      action="add"
      className="shrink-0"
      icon={ShoppingCartIcon}
      label={t("putOnTheList")}
      size="sm"
      variant="tertiary"
      onPress={onPut}
    />
  );
}
