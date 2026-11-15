import React from "react";
import { Text, View } from "react-native";
import { useIntl } from "react-intl";

import type { GroceryPrice } from "@norish/shared-react/groceries";
import { formatPackSize, formatShelfPrice } from "@norish/shared/lib/format-price";
import { packSizeOf } from "@norish/shared/lib/pack-size";

/** The Store Product a grocery is priced by, and what the grocery costs of it; nothing while the Store has none. */
export function ProductRow({ price }: { price: GroceryPrice }) {
  const intl = useIntl();

  if (price.status !== "priced") return null;

  const { product, cost, regularCost } = price;
  const format = (amount: number) => formatShelfPrice(intl.locale, amount, product.currency);
  const pack = packSizeOf(product);
  const size =
    product.size ??
    (pack
      ? formatPackSize(pack, {
          per: (unit) => intl.formatMessage({ id: "groceries.price.perUnit" }, { unit }),
          pieces: (count) => intl.formatMessage({ id: "groceries.price.pieces" }, { count }),
        })
      : null);

  return (
    <View className="flex-row items-center gap-3 px-4 py-3" testID="grocery-product">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-foreground text-base font-medium" numberOfLines={2}>
          {product.name}
        </Text>
        <Text className="text-muted text-[13px]" numberOfLines={1}>
          {[format(product.price), size].filter(Boolean).join(" · ")}
          {regularCost === null || product.regularPrice === null ? null : (
            <Text className="line-through">{` ${format(product.regularPrice)}`}</Text>
          )}
        </Text>
      </View>
      <Text className="text-foreground text-[17px] font-semibold tabular-nums">
        {format(cost.cost)}
      </Text>
    </View>
  );
}
