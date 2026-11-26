"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { PickerKind } from "./entry-matching";
import { useTRPC } from "../trpc";
import { entryAccess, renameView } from "./content-view";
import { useContentWrites } from "./use-content-writes";
import { useListEntries } from "./use-list-entries";

export type ContentEntryProblem = "stale" | "failed" | "tooLong" | "empty";

/** What deleting comes off: `household` recipes of the reader's, or `server` every household's. */
export interface DeleteImpact {
  recipes: number;
  scope: "household" | "server";
}

/**
 * One entry's panel: its name as edited, saved as a rename or, onto another entry's name, a merge;
 * and its delete with how many recipes it comes off (an admin deleting a server entry sees every
 * household's, read from the server; `null` until it is). An entry changed by someone else
 * meanwhile is read again and `problem` is `stale`, nothing overwritten. `gone` when it is deleted.
 */
export function useContentEntry(kind: PickerKind, id: string) {
  const trpc = useTRPC();
  const { entries, loaded } = useListEntries(kind);
  const writes = useContentWrites(kind);
  const entry = entries.find((known) => known.id === id) ?? null;
  const [name, setName] = useState(entry?.name ?? "");
  const [outcome, setOutcome] = useState<"stale" | "failed" | null>(null);
  const forServer = entry !== null && entry.instance && entry.editable;
  const server = useQuery({
    ...trpc.lists.usage.queryOptions({ kind, id }),
    enabled: forServer,
  });
  const view = entry ? renameView(kind, entries, entry, name) : null;
  let deleteImpact: DeleteImpact | null = null;

  if (entry?.editable && !entry.instance)
    deleteImpact = { recipes: entry.recipeCount, scope: "household" };
  else if (server.data) deleteImpact = { recipes: server.data.recipeCount, scope: "server" };

  /** Runs a write: resolves whether it went through, and keeps why not. */
  const settle = async (write: () => Promise<{ status: string }>) => {
    setOutcome(null);

    const result = await write();

    if (result.status === "stale") setOutcome("stale");
    else if (result.status !== "saved") setOutcome("failed");

    return result.status === "saved";
  };

  return {
    entry,
    access: entry ? entryAccess(kind, entry) : null,
    gone: loaded && entry === null,
    name,
    setName: (next: string) => {
      setOutcome(null);
      setName(next);
    },
    view,
    problem: (view?.problem ?? outcome) satisfies ContentEntryProblem | null,
    offline: writes.offline,
    pending: writes.pending,
    canSave: view?.canSave === true && !writes.offline && !writes.pending,
    deleteImpact,
    /** Renames, or merges onto the entry the name folds onto; resolves whether it was saved. */
    save: () =>
      entry && view?.canSave
        ? settle(() => writes.rename(entry, name.trim()))
        : Promise.resolve(false),
    remove: () => (entry ? settle(() => writes.remove(entry)) : Promise.resolve(false)),
  };
}
