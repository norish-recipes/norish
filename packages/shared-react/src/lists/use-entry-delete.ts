"use client";

import type { ContentEntry } from "./content-view";
import type { PickerKind } from "./entry-matching";
import type { DeleteImpact } from "./use-content-entry";
import { useTRPCClient } from "../trpc";
import { useContentWrites } from "./use-content-writes";

/** How a delete came out: `deleted`, or why not. */
export type DeleteOutcome = "deleted" | "stale" | "failed";

/**
 * Deleting an entry from where it is listed, no sheet open: `impact` reads what it comes off (the
 * household's recipes, or every household's for a server entry; null when that read fails) and
 * `remove` sends the delete.
 */
export function useEntryDelete(kind: PickerKind) {
  const client = useTRPCClient();
  const writes = useContentWrites(kind);

  return {
    offline: writes.offline,
    impact: async (entry: ContentEntry): Promise<DeleteImpact | null> => {
      if (!entry.instance) return { recipes: entry.recipeCount, scope: "household" };

      try {
        const usage = await client.lists.usage.query({ kind, id: entry.id });

        return { recipes: usage.recipeCount, scope: "server" };
      } catch {
        return null;
      }
    },
    remove: async (entry: ContentEntry): Promise<DeleteOutcome> => {
      const result = await writes.remove(entry);

      if (result.status === "saved") return "deleted";

      return result.status === "stale" ? "stale" : "failed";
    },
  };
}
