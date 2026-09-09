/**
 * A Sale is what the shop presents: a regular price above the price it
 * charges now. A regular price that is not above the price is no Sale — a
 * shop restating its own price, or a reading gone wrong — and is read as
 * none, wherever a price and a regular price meet (ADR-0029).
 */
export function saleRegularPrice(
  price: number,
  regularPrice: number | null | undefined
): number | null {
  return regularPrice !== null && regularPrice !== undefined && regularPrice > price
    ? regularPrice
    : null;
}
