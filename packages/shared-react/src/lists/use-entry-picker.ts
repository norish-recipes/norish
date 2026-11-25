"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PickerEntry, PickerKind } from "./entry-matching";
import { useCategoriesQuery } from "../config";
import { useConnectivity } from "../offline/react";
import { answered } from "../offline/settled";
import { useTRPC } from "../trpc";
import { createOffer, matchEntries } from "./entry-matching";
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

/**
 * What a Tag, Cuisine or Category picker shows for typed text: the entries it matches first, and
 * a "Create 'x'" row only where the list has no entry of that name. Creating needs the server,
 * so offline the row is offered but not taken. It makes the entry (`lists.add`) and then selects
 * what the server answers; a second call while one is under way does nothing.
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
  const { entries, isLoading } = useListEntries(kind, recipeId);
  const add = useMutation(trpc.lists.add.mutationOptions());
  const underWayRef = useRef(false);
  const [failedName, setFailedName] = useState<string | null>(null);
  const aliases = kind === "category" ? builtInAliases : undefined;
  const offer = createOffer(kind, entries, typed, aliases);
  const matches = matchEntries(
    kind,
    entries.filter((entry) => !isSelected(entry)),
    typed,
    aliases
  );

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
    onSelect(added.entry);
  };

  return {
    isLoading,
    matches,
    offer,
    /** The "Create" row is offered but cannot be taken: offline, or while one is being made. */
    createDisabled: isOffline || add.isPending,
    isOffline,
    isCreating: add.isPending,
    /** Making the entry for the offered name failed; the name is still offered. */
    createFailed: offer.kind === "create" && failedName === offer.name,
    createAndSelect,
  };
}
