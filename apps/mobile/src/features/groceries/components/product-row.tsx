import React from "react";
import { CardRow } from "@/components/card";
import { Text } from "react-native";
import { useIntl } from "react-intl";

import type { GroceryPrice } from "@norish/shared-react/groceries";
import { formatPackSize, formatShelfPrice } from "@norish/shared/lib/format-price";
import { packSizeOf } from "@norish/shared/lib/pack-size";

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

  const format = (amount: number, currency: string) =>
    formatShelfPrice(intl.locale, amount, currency);
  let value = intl.formatMessage({ id: "groceries.mobile.chooseProduct" });
  let detail: React.ReactNode = null;

  if (held) {
    value = [held.name, held.detail].filter(Boolean).join(" · ");
  } else if (priced) {
    const { product, regularCost } = priced;
    const pack = packSizeOf(product);
    const size =
      product.size ??
      (pack
        ? formatPackSize(pack, {
            per: (unit) => intl.formatMessage({ id: "groceries.price.perUnit" }, { unit }),
            pieces: (count) => intl.formatMessage({ id: "groceries.price.pieces" }, { count }),
          })
        : intl.formatMessage({ id: "groceries.price.each" }));

    value = `${product.name} · ${format(priced.cost.cost, product.currency)}`;
    detail = (
      <>
        {[format(product.price, product.currency), size].filter(Boolean).join(" · ")}
        {regularCost === null || product.regularPrice === null ? null : (
          <Text className="line-through">{` ${format(product.regularPrice, product.currency)}`}</Text>
        )}
      </>
    );
  }

  return (
    <CardRow
      first
      detail={detail}
      label={intl.formatMessage({ id: "groceries.mobile.product" })}
      testID="grocery-product"
      value={value}
      valueLines={2}
      onPress={onPress}
    />
  );
}
