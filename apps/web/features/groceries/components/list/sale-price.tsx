"use client";

interface SalePriceProps {
  /** The price, formatted. */
  price: string;
  /** The regular price the shop struck through, formatted; null where this is no Sale. */
  regular: string | null;
  /** What the struck price is, for a reader who cannot see the strike. */
  regularLabel?: string;
  /** The shop's own words for the deal, where it printed any. */
  words: string | null;
  testIds?: { sale?: string; words?: string; regular?: string };
}

/**
 * A price the way a shelf tag shows a deal, and no louder: on a Sale the
 * regular price is struck through and the new price stands beside it, the
 * same size and weight as any price that is not on Sale. The shop's own words
 * for the deal are the price's title, for whoever wants them, never a badge
 * or a chip of their own. Words the shop keeps over its regular price,
 * "2 voor €5.50", are no Sale: the price stands as it is, with the words as
 * its title, never worked into the number.
 */
export function SalePrice({ price, regular, regularLabel, words, testIds = {} }: SalePriceProps) {
  const onSale = regular !== null;

  return (
    <>
      {onSale && (
        <>
          <s
            aria-label={regularLabel}
            className="text-muted font-normal"
            data-testid={testIds.regular}
          >
            {regular}
          </s>{" "}
        </>
      )}
      <span
        data-testid={onSale ? testIds.sale : words ? testIds.words : undefined}
        title={words ?? undefined}
      >
        {price}
      </span>
    </>
  );
}
