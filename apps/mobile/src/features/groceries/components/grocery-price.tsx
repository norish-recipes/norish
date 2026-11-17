import React from "react";
import { Text, View } from "react-native";
import { Loader } from "@/components/loader";
import { useIntl } from "react-intl";

import type { PricedLine } from "@norish/shared-react/groceries";
import { useGroceryPrice } from "@norish/shared-react/groceries";
import { formatShelfPrice } from "@norish/shared/lib/format-price";

/** What a row costs at its Store: the Line Cost, the regular one struck through beside it on a
 * Sale, a spinner while the Store is still being asked, nothing for a Miss. */
export function GroceryPrice({
  line,
  size = "base",
  muted = false,
}: {
  line: PricedLine;
  size?: "base" | "small";
  muted?: boolean;
}) {
  const intl = useIntl();
  const price = useGroceryPrice(line);

  if (price.status === "none") return null;
  if (price.status === "pending") {
    return (
      <View testID="grocery-price-pending">
        <Loader inline label={intl.formatMessage({ id: "groceries.price.pending" })} />
      </View>
    );
  }

  const { product, cost, regularCost } = price;
  const format = (amount: number) => formatShelfPrice(intl.locale, amount, product.currency);
  const sizeClass = size === "base" ? "text-base" : "text-[15px]";

  return (
    <View className="flex-row items-baseline gap-1.5" testID="grocery-price">
      {regularCost === null ? null : (
        <Text
          accessibilityLabel={intl.formatMessage(
            { id: "groceries.price.regularPrice" },
            { price: format(regularCost) }
          )}
          className="text-muted text-sm line-through"
        >
          {format(regularCost)}
        </Text>
      )}
      <Text
        className={`${sizeClass} tabular-nums ${muted ? "text-muted" : "text-foreground"}`}
        testID="grocery-line-cost"
      >
        {format(cost.cost)}
      </Text>
    </View>
  );
}
