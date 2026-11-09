"use client";

import { OnTheListMark } from "@/components/ingredients/on-the-list-mark";
import { IconActionButton } from "@/components/shared/action-button";
import { showActionToast } from "@/lib/ui/action-toast";
import { ShoppingCartIcon } from "@heroicons/react/16/solid";
import { useLocale, useTranslations } from "next-intl";

import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { useGroceriesMutations } from "@norish/shared-react/groceries";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/** A kept food, as much of it as putting it on the list needs. */
export type KeptFood = { name: string; localeNames?: LocaleNames };

/**
 * Running out of a kept food: one grocery for it, named the way the reader
 * reads the food, with no amount and no Store, so the server files it where
 * the household buys that food, else under Unsorted. The food stays in the
 * Pantry. It is optimistic and queues offline like any grocery, and the
 * toast's Undo deletes the grocery it made.
 */
export function usePutOnTheList(): (food: KeptFood) => void {
  const t = useTranslations("groceries.pantry");
  const locale = useLocale();
  const { createGroceriesFromData, deleteGroceries } = useGroceriesMutations();

  return (food) => {
    const name = ingredientDisplayName(food, locale);
    // A failed create says so itself, and puts the list back.
    const created = createGroceriesFromData([{ name, amount: null, unit: null }]);

    created.catch(() => undefined);
    showActionToast(t("putOnTheListToast", { name }), {
      variant: "success",
      action: {
        label: t("undo"),
        onPress: () => void created.then(deleteGroceries, () => undefined),
      },
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
