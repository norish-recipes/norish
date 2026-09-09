"use client";

import { useStoresContext } from "@/app/(app)/groceries/stores-context";
import { formatShelfPrice } from "@/lib/format-price";
import { useLocale, useTranslations } from "next-intl";

import type { PricedLine } from "./store-total";
import { storeTotal } from "./store-total";

interface StoreHeadingTotalProps {
  /** The rows the section shows: one Line Cost each, so the heading is the sum of what is under it. */
  lines: PricedLine[];
  storeId: string | null;
}

/**
 * What is still to buy at this Store costs this, in the heading of the section
 * the shopper is standing in front of. Both the flat and the grouped list
 * render it, and each hands over exactly the rows it shows.
 */
export function StoreHeadingTotal({ lines, storeId }: StoreHeadingTotalProps) {
  const { priceFor } = useStoresContext();
  const locale = useLocale();
  const t = useTranslations("groceries.store");
  const total = storeTotal(lines, priceFor, storeId);

  if (!total) return null;

  return (
    <span
      className="text-muted shrink-0 text-sm tabular-nums"
      data-testid="store-total"
      title={t("total")}
    >
      {formatShelfPrice(locale, total.amount, total.currency)}
    </span>
  );
}
