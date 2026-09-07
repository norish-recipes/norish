"use client";

interface AisleHeadingProps {
  name: string;
  /** Nothing is filed here: the heading stays, so the shop's shape is always visible, but quieter. */
  empty: boolean;
}

/**
 * An Aisle's heading within a Store's block: the aisle's name and nothing
 * else, slim enough that the list still reads as a list. Rendered whether or
 * not anything is filed under it, an empty one quieter than a filled one.
 */
export function AisleHeading({ name, empty }: AisleHeadingProps) {
  return (
    <div
      className={`px-4 pt-2.5 pb-1 text-xs font-semibold tracking-wide uppercase ${
        empty ? "text-muted/50" : "text-muted"
      }`}
      data-aisle-empty={empty}
      data-testid="aisle-heading"
    >
      {name}
    </div>
  );
}
