"use client";

import { useStoresContext } from "@/app/(app)/groceries/stores-context";
import { formatShelfPrice } from "@/lib/format-price";
import { Spinner } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { groupLineCost } from "@norish/shared/lib/line-cost";
import { packSizeOf } from "@norish/shared/lib/pack-size";
import { isPendingLink } from "@norish/shared/lib/product-link";
import { saleRegularPrice } from "@norish/shared/lib/sale";

import type { PricedLine } from "./store-total";
import { SalePrice } from "./sale-price";

/**
 * What this row costs at its Store, in two quiet lines: the Line Cost with
 * the purchase arithmetic beside it, `€4.38 (2 × €2.19)`, and the product
 * that price is for. On a Sale the money line reads the way a shelf tag
 * does: the regular Line Cost struck through, the new one beside it like any
 * other price, the shop's own words for the deal as its title.
 * Where the amount could not be reconciled with the pack, a note that one
 * pack was counted.
 *
 * While the Store is still being asked, a loader where the price would be
 * and no words: waiting must read as waiting and not as failure.
 */
export function GroceryPrice({ line }: { line: PricedLine }) {
  const { linkFor } = useStoresContext();
  const locale = useLocale();
  const t = useTranslations("groceries.price");
  const link = linkFor(line.storeId, line.name);

  if (!link) return null;
  if (isPendingLink(link)) {
    return (
      <span className="flex shrink-0 items-center justify-end" data-testid="grocery-price-pending">
        <Spinner aria-label={t("pending")} className="text-muted" color="current" size="sm" />
      </span>
    );
  }

  const product = link.product;

  if (!product) return null;
  const pack = packSizeOf(product);
  const cost = groupLineCost(line.amounts, { price: product.price, pack });
  // The regular Line Cost: the same packs at the price the shop struck through.
  const regularPrice = saleRegularPrice(product.price, product.regularPrice);
  const regular =
    regularPrice === null ? null : groupLineCost(line.amounts, { price: regularPrice, pack }).cost;
  const regularWords =
    regular === null ? null : formatShelfPrice(locale, regular, product.currency);
  const detail = `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(cost.purchaseAmount)} × ${formatShelfPrice(locale, product.price, product.currency)}`;

  return (
    <span
      className="flex w-full min-w-0 flex-col items-start gap-0.5 text-left sm:w-auto sm:max-w-[55%] sm:items-end sm:text-right"
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
        <span className="text-muted text-xs font-normal" data-testid="grocery-price-calculation">
          {` (${detail})`}
        </span>
      </span>
      <span
        className="text-muted w-full truncate text-xs"
        data-testid="grocery-product"
        title={product.name}
      >
        {product.name}
      </span>
      {!cost.matched && (
        <span className="text-muted text-xs" data-testid="grocery-one-pack">
          {t("onePack")}
        </span>
      )}
    </span>
  );
}
