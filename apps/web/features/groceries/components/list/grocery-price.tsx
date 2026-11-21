"use client";

import { Spinner } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { PricedLine } from "@norish/shared-react/groceries";
import { useGroceryPrice } from "@norish/shared-react/groceries";
import { formatShelfPrice } from "@norish/shared/lib/format-price";

import { SalePrice } from "./sale-price";

/**
 * What this row costs at its Store, in two quiet lines: the Line Cost with
 * the purchase arithmetic beside it, `€4.38 (2 × €2.19)`, and the product
 * that price is for. A phone's row has room for the Line Cost alone; the rest
 * is in the grocery's panel. On a Sale the money line reads the way a shelf tag
 * does: the regular Line Cost struck through, the new one beside it like any
 * other price, the shop's own words for the deal as its title.
 * Where the amount could not be reconciled with the pack, a note that one
 * pack was counted.
 *
 * While the Store is still being asked, a loader where the price would be
 * and no words: waiting must read as waiting and not as failure.
 */
export function GroceryPrice({ line }: { line: PricedLine }) {
  const price = useGroceryPrice(line);
  const locale = useLocale();
  const t = useTranslations("groceries.price");

  if (price.status === "none") return null;
  if (price.status === "pending") {
    return (
      <span className="flex shrink-0 items-center justify-end" data-testid="grocery-price-pending">
        <Spinner aria-label={t("pending")} className="text-muted" color="current" size="sm" />
      </span>
    );
  }

  const { product, cost, regularCost } = price;
  const regularWords =
    regularCost === null ? null : formatShelfPrice(locale, regularCost, product.currency);
  const detail = `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(cost.purchaseAmount)} × ${formatShelfPrice(locale, product.price, product.currency)}`;

  return (
    <span
      className="flex min-w-0 shrink-0 flex-col items-end gap-0.5 text-right sm:max-w-[55%] sm:shrink"
      data-grocery-packs={cost.packs}
      data-grocery-price={product.id}
      data-testid="grocery-price"
    >
      <span
        className="text-foreground text-sm font-medium tabular-nums"
        data-testid="grocery-line-cost"
      >
        <SalePrice
          price={formatShelfPrice(locale, cost.cost, product.currency)}
          regular={regularWords}
          regularLabel={
            regularWords === null ? undefined : t("regularPrice", { price: regularWords })
          }
          testIds={{
            sale: "grocery-sale",
            words: "grocery-deal-words",
            regular: "grocery-regular-cost",
          }}
          words={product.dealWords ?? null}
        />
        <span
          className="text-muted hidden text-xs font-normal sm:inline"
          data-testid="grocery-price-calculation"
        >
          {` (${detail})`}
        </span>
      </span>
      <span
        className="text-muted hidden w-full truncate text-xs sm:block"
        data-testid="grocery-product"
        title={product.name}
      >
        {product.name}
      </span>
      {!cost.matched && (
        <span className="text-muted hidden text-xs sm:block" data-testid="grocery-one-pack">
          {t("onePack")}
        </span>
      )}
    </span>
  );
}
