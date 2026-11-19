import React from "react";
import { CardRow } from "@/components/card";
import { useIntl } from "react-intl";

import type { GroceryPrice } from "@norish/shared-react/groceries";
import { formatShelfPrice } from "@norish/shared/lib/format-price";

/** A product the form holds that the list does not price yet: a pick, or a Store's own link. */
export type HeldProduct = { name: string; detail: string };

/** The Store Product a grocery is priced by, as a card row: "Product", then its name and cost. A
 * held product (just chosen, or not on the list) has no cost. With `onPress` the row opens the
 * product search, and shows while empty. */
export function ProductRow({
  price,
  held = null,
  onPress,
}: {
  price: GroceryPrice;
  held?: HeldProduct | null;
  onPress?: () => void;
}) {
  const intl = useIntl();
  const priced = held === null && price.status === "priced" ? price : null;

  if (!held && !priced && !onPress) return null;

  let value = intl.formatMessage({ id: "groceries.mobile.chooseProduct" });

  if (held) {
    value = [held.name, held.detail].filter(Boolean).join(" · ");
  } else if (priced) {
    value = `${priced.product.name} · ${formatShelfPrice(intl.locale, priced.cost.cost, priced.product.currency)}`;
  }

  return (
    <CardRow
      first
      label={intl.formatMessage({ id: "groceries.mobile.product" })}
      testID="grocery-product"
      value={value}
      onPress={onPress}
    />
  );
}
