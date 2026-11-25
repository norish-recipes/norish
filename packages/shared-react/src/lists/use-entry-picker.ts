"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";

import type { PickerEntry, PickerKind } from "./entry-matching";
import { useCategoriesQuery } from "../config";
import { useConnectivity } from "../offline/react";
import { answered } from "../offline/settled";
import { useTRPC } from "../trpc";
import { entryPickerView } from "./entry-matching";
import { useListEntries } from "./use-list-entries";

interface EntryPickerOptions {
  kind: PickerKind;
  /** The recipe being edited, when it exists: its household's list is the one to offer. */
  recipeId?: string;
  /** What the reader has typed so far. */
  typed: string;
  /** Whether an entry is on the recipe already, so it is not offered again. */
  isSelected: (entry: PickerEntry) => boolean;
  /** Takes the entry the reader picked, or the one their "Create" row just made. */
  onSelect: (entry: PickerEntry) => void;
}

/** Whether any picker is making an entry: a save waits for it, or it would leave the entry out. */
export function useEntryCreatePending() {
  const trpc = useTRPC();

  return useIsMutating({ mutationKey: trpc.lists.add.mutationKey() }) > 0;
}

/**
 * What a Tag, Cuisine or Category picker shows for typed text: the entries it matches first, and
 * a "Create 'x'" row only where the loaded list has no entry of that name. Creating needs the
 * server, so offline the row is offered but not taken. It makes the entry (`lists.add`) and then
 * selects what the server answers, through the latest `onSelect`; a second call while one is
 * under way does nothing. A failed create stays said until the reader picks or tries again.
 */
export function useEntryPicker({
  kind,
  recipeId,
  typed,
  isSelected,
  onSelect,
}: EntryPickerOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isOffline } = useConnectivity();
  const { builtInAliases } = useCategoriesQuery();
  const { entries, loaded, failed, retry } = useListEntries(kind, recipeId);
  const add = useMutation(trpc.lists.add.mutationOptions());
  const underWayRef = useRef(false);
  // A create answers later: what it selects into is what the form holds then, not when it began.
  const selectRef = useRef(onSelect);
  const [failedName, setFailedName] = useState<string | null>(null);
  const view = entryPickerView({
    kind,
    entries,
    loaded,
    listFailed: failed,
    typed,
    isSelected,
    aliases: kind === "category" ? builtInAliases : undefined,
    failedName,
    offline: isOffline,
  });
  const { offer } = view;

  useEffect(() => {
    selectRef.current = onSelect;
  });

  const pick = (entry: PickerEntry) => {
    setFailedName(null);
    selectRef.current(entry);
  };

  const createAndSelect = async () => {
    if (offer.kind !== "create" || isOffline || underWayRef.current) return;

    underWayRef.current = true;
    setFailedName(null);

    const added = await answered(add.mutateAsync({ kind, name: offer.name, recipeId }));

    underWayRef.current = false;

    if (!added) {
      setFailedName(offer.name);

      return;
    }

    // The list shows it at once, so a repeated Enter finds it instead of offering it again.
    queryClient.setQueryData(trpc.lists.list.queryKey({ kind, recipeId }), (current) =>
      current && !current.some((known) => known.id === added.entry.id)
        ? [...current, added.entry]
        : current
    );
    pick(added.entry);
  };

  return {
    ...view,
    /** The "Create" row is offered but cannot be taken: offline, or while one is being made. */
    createDisabled: isOffline || add.isPending,
    pick,
    createAndSelect,
    retryList: retry,
  };
}
