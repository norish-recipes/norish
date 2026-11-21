/**
 * The Offline Cache on disk: one `keyval` entry per persisted read, under its owner's prefix
 * (ADR-0005), so a save writes only the reads that changed rather than the whole cache.
 *
 * Every operation is best-effort — a persistence failure must degrade to an in-memory cache,
 * never crash a render.
 */

import type { DehydratedState } from "@tanstack/react-query";

import type { OfflineStorage } from "./storage";
import { ownerFromCacheKey, queryCacheKey, queryCachePrefix } from "./cache-identity";

type DehydratedQuery = DehydratedState["queries"][number];

/** One persisted read, with the app version and the time it was saved under. */
interface StoredQuery {
  buster: string | undefined;
  savedAt: number;
  query: DehydratedQuery;
}

// When the copy was last in use; a query hash is JSON, so it never collides with this key.
const usedKey = (owner: string) => queryCacheKey(owner, "used");

const isStoredQuery = (value: unknown): value is StoredQuery =>
  typeof value === "object" && value !== null && "query" in value && "savedAt" in value;

export function createQueryStore(keyval: OfflineStorage["keyval"]) {
  /** Every key of `owner`'s, whatever shape its value has. */
  const ownerEntries = async (owner: string) =>
    (await keyval.entries<unknown>(queryCachePrefix(owner))).filter(
      ([key]) => ownerFromCacheKey(key) === owner
    );

  /** Mark `owner`'s copy as in use now, which restarts its `maxAge`. */
  const touch = async (owner: string) => {
    try {
      await keyval.set(usedKey(owner), Date.now());
    } catch {
      // Ignore — the copy then ages from its newest save.
    }
  };

  return {
    /** `owner`'s reads saved under `buster`, all of them while the newest save or use is within
     * `maxAge` (an Offline Cache in use never ages out read by read); the rest are deleted. */
    async restore(
      owner: string,
      { buster, maxAge }: { buster: string | undefined; maxAge: number }
    ): Promise<DehydratedQuery[]> {
      try {
        const entries = await ownerEntries(owner);
        const current = entries.filter(
          (entry): entry is [string, StoredQuery] =>
            isStoredQuery(entry[1]) && entry[1].buster === buster
        );
        const used = entries.find(([key]) => key === usedKey(owner))?.[1];
        const newest = Math.max(
          typeof used === "number" ? used : 0,
          ...current.map(([, stored]) => stored.savedAt)
        );
        const kept = Date.now() - newest <= maxAge ? current : [];
        const keptKeys = new Set(kept.map(([key]) => key));

        if (kept.length > 0) keptKeys.add(usedKey(owner));
        await Promise.allSettled([
          ...entries.filter(([key]) => !keptKeys.has(key)).map(([key]) => keyval.del(key)),
          ...(kept.length > 0 ? [touch(owner)] : []),
        ]);

        return kept.map(([, stored]) => stored.query);
      } catch {
        return [];
      }
    },

    async write(owner: string, query: DehydratedQuery, buster: string | undefined) {
      const stored: StoredQuery = { buster, savedAt: Date.now(), query };

      try {
        await keyval.set(queryCacheKey(owner, query.queryHash), stored);
      } catch {
        // Ignore — the read simply stays in memory this session.
      }
    },

    touch,

    async remove(owner: string, queryHash: string) {
      try {
        await keyval.del(queryCacheKey(owner, queryHash));
      } catch {
        // Ignore — a stale read is dropped by its buster or maxAge at the next restore.
      }
    },

    /** Delete every read of `owner`'s. */
    async clear(owner: string) {
      try {
        const entries = await ownerEntries(owner);

        await Promise.allSettled(entries.map(([key]) => keyval.del(key)));
      } catch {
        // Ignore — the next restore drops what its buster or maxAge rules out.
      }
    },
  };
}
