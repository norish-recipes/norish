/** Whether the Reader may act on a row of `ownerId`'s; a row nobody owns (Orphaned) is open to all. */
export function ownerAllows(
  ownerId: string | null | undefined,
  check: (ownerId: string) => boolean
): boolean {
  return ownerId ? check(ownerId) : true;
}
