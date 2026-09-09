"use client";

import { useTranslations } from "next-intl";

/** One slim heading for the parts of a Store's block: an aisle, or the done tail. */
export const BLOCK_HEADING_CLASS = "px-4 pt-3 pb-1.5 text-sm font-semibold tracking-wide uppercase";

interface AisleHeadingProps {
  aisleId: string;
  name: string;
  /** Nothing is filed here: the heading stays, so the shop's shape is always visible, but quieter. */
  empty: boolean;
}

/**
 * An Aisle's heading within a Store's block: the aisle's name and nothing
 * else, slim enough that the list still reads as a list. Rendered whether or
 * not anything is filed under it, an empty one quieter than a filled one.
 */
export function AisleHeading({ aisleId, name, empty }: AisleHeadingProps) {
  return (
    <div
      className={`${BLOCK_HEADING_CLASS} ${empty ? "text-muted/50" : "text-muted"}`}
      data-aisle-drop-target={aisleId}
      data-aisle-empty={empty}
      data-testid="aisle-heading"
    >
      {name}
    </div>
  );
}

/**
 * The heading over a Store's done tail. Under aisle headings a ticked row
 * would read as filed in the last aisle, so the tail says what it is; a Store
 * with no aisles renders its tail exactly as it always has.
 */
export function DoneHeading() {
  const t = useTranslations("groceries.store");

  return (
    <div className={`${BLOCK_HEADING_CLASS} text-muted`} data-testid="done-heading">
      {t("doneHeading")}
    </div>
  );
}
