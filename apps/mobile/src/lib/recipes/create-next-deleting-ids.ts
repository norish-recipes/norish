export function createNextDeletingIds(prev: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (prev.has(id)) {
    return prev;
  }

  const next = new Set(prev);
  next.add(id);
  return next;
}
