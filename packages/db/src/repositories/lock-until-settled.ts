/** How many fresh reads a lock taken on what was read may need before nothing more moved. */
const SETTLE_ATTEMPTS = 5;

/**
 * Locks what `read` finds until a fresh read finds nothing it has not locked: a write a lock waited
 * for may have moved what was read onto rows the earlier read did not see. Answers the last read.
 */
export async function lockUntilSettled<R>(
  read: () => Promise<R[]>,
  lock: (rows: R[]) => Promise<unknown>,
  key: (row: R) => string
): Promise<R[]> {
  const held = new Set<string>();

  for (let attempt = 1; ; attempt++) {
    const rows = await read();
    const fresh = rows.filter((row) => !held.has(key(row)));

    if (fresh.length === 0) return rows;
    if (attempt > SETTLE_ATTEMPTS) throw new Error("Rows kept moving while they were locked");
    await lock(fresh);
    for (const row of fresh) held.add(key(row));
  }
}
