"use client";

import { useState } from "react";

import type { ContentEntry } from "./content-view";
import type { CreateOffer, PickerEntry, PickerKind } from "./entry-matching";
import { usePermissions } from "../reader";
import { createOffer, matchEntries } from "./entry-matching";
import { useContentWrites } from "./use-content-writes";
import { useListEntries } from "./use-list-entries";

export type ContentAddProblem = "loadFailed" | "tooLong" | "failed" | "stale";

/**
 * The Add flow of one list: the entries the typed name already matches, and a create only where
 * none folds alike (the server decides; an entry it answers instead is `existing`). A server
 * admin may add a Cuisine for the server's list (`canAddForServer`).
 */
export function useContentAdd(kind: PickerKind) {
  const { entries, loaded, failed } = useListEntries(kind);
  const writes = useContentWrites(kind);
  const isAdmin = usePermissions((permissions) => permissions.isServerAdmin);
  const [typed, setTyped] = useState("");
  const [forServer, setForServer] = useState(false);
  const [failedAdd, setFailedAdd] = useState(false);
  const canAddForServer = isAdmin && kind === "cuisine";
  const toServer = canAddForServer && forServer;
  // A server entry's fold is unique among the server's only; a household's among both.
  const pool: ContentEntry[] = toServer ? entries.filter((entry) => entry.instance) : entries;
  const offer: CreateOffer = loaded ? createOffer(kind, pool, typed) : { kind: "none" };
  let problem: ContentAddProblem | null = null;

  if (failed) problem = "loadFailed";
  else if (offer.kind === "tooLong") problem = "tooLong";
  else if (failedAdd) problem = "failed";

  return {
    typed,
    setTyped: (next: string) => {
      setFailedAdd(false);
      setTyped(next);
    },
    forServer: toServer,
    setForServer,
    canAddForServer,
    matches: matchEntries(kind, pool, typed),
    offer,
    problem,
    max: offer.kind === "tooLong" ? offer.max : undefined,
    offline: writes.offline,
    canAdd: offer.kind === "create" && !writes.offline && !writes.pending,
    /** Adds the typed name; resolves the entry and whether it was made, or null when it was not. */
    add: async (): Promise<{ entry: PickerEntry; created: boolean } | null> => {
      if (offer.kind !== "create" || writes.offline) return null;

      setFailedAdd(false);

      const result = await writes.add(offer.name, toServer);

      if (result.status !== "saved") {
        setFailedAdd(true);

        return null;
      }

      return result.value;
    },
  };
}
