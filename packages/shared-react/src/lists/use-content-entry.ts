"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { PickerKind } from "./entry-matching";
import { useTRPC } from "../trpc";
import { entryDetail, renameView } from "./content-view";
import { useContentWrites } from "./use-content-writes";
import { useListEntries } from "./use-list-entries";

export type ContentEntryProblem = "stale" | "failed" | "tooLong" | "empty";

/** Where a delete stands: its count is being read or failed, it can go ahead, or it came to `stale` or `failed`. */
export type DeleteState = "counting" | "countFailed" | "ready" | "stale" | "failed";

/** What deleting comes off: `household` recipes of the reader's, or `server` every household's. */
export interface DeleteImpact {
  recipes: number;
  scope: "household" | "server";
}

/**
 * One entry's panel: its name as edited, saved as a rename or a merge, and its delete with the
 * recipes it comes off (an admin's server entry counts every household's).
 */
export function useContentEntry(kind: PickerKind, id: string) {
  const trpc = useTRPC();
  const { entries, loaded } = useListEntries(kind);
  const writes = useContentWrites(kind);
  const entry = entries.find((known) => known.id === id) ?? null;
  // The name as edited; until it is, the entry's own, so an entry that arrives later has it too.
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? entry?.name ?? "";
  const [outcome, setOutcome] = useState<"stale" | "failed" | null>(null);
  const [deleteOutcome, setDeleteOutcome] = useState<"stale" | "failed" | null>(null);
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

  const countFailed = forServer && server.isError && !server.data;
  let deleteState: DeleteState = "ready";

  if (deleteOutcome) deleteState = deleteOutcome;
  else if (countFailed) deleteState = "countFailed";
  else if (deleteImpact === null) deleteState = "counting";

  /** Runs a write: resolves whether it went through, and keeps why not. */
  const settle = async (
    write: () => Promise<{ status: string }>,
    keep: (why: "stale" | "failed" | null) => void
  ) => {
    keep(null);

    const result = await write();

    if (result.status === "stale") keep("stale");
    else if (result.status !== "saved") keep("failed");

    return result.status === "saved";
  };

  return {
    entry,
    detail: entry ? entryDetail(kind, entry) : null,
    gone: loaded && entry === null,
    name,
    setName: (next: string) => {
      setOutcome(null);
      setDraft(next);
    },
    view,
    problem: (view?.problem ?? outcome) satisfies ContentEntryProblem | null,
    offline: writes.offline,
    pending: writes.pending,
    canSave: view?.canSave === true && !writes.offline && !writes.pending,
    deleteImpact,
    deleteState,
    /** Why the last delete did not go through. */
    deleteProblem: deleteOutcome satisfies ContentEntryProblem | null,
    /** Forgets why the last delete did not go through, as its confirmation closes. */
    resetDelete: () => setDeleteOutcome(null),
    /** Reads the server's count again after it failed. */
    retryCount: () => void server.refetch(),
    /** Renames, or merges onto the entry the name folds onto; resolves whether it was saved. */
    save: () =>
      entry && view?.canSave
        ? settle(() => writes.rename(entry, name.trim()), setOutcome)
        : Promise.resolve(false),
    remove: () =>
      entry ? settle(() => writes.remove(entry), setDeleteOutcome) : Promise.resolve(false),
  };
}
