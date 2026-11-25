"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PickerEntry, PickerKind } from "./entry-matching";
import { useCategoriesQuery } from "../config";
import { MUTATION_SEND_TIMEOUT_MS } from "../offline/outbox-link";
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

// The creates under way, each held by the picker that started it until it settles, times out or goes.
const creating = new Set<symbol>();
const watchers = new Set<() => void>();

function track(token: symbol, on: boolean) {
  if (on) creating.add(token);
  else creating.delete(token);
  watchers.forEach((notify) => notify());
}

/** Whether a mounted picker is making an entry: a save waits for it, or it would leave the entry out. */
export function useEntryCreatePending() {
  return useSyncExternalStore(
    (notify) => {
      watchers.add(notify);

      return () => watchers.delete(notify);
    },
    () => creating.size > 0,
    () => false
  );
}

/**
 * What a Tag, Cuisine or Category picker shows for typed text: the entries it matches first, and
 * a "Create 'x'" row only where the loaded list has no entry of that name. Creating needs the
 * server, so offline the row is offered but not taken. It makes the entry (`lists.add`) and then
 * selects what the server answers, through the latest `onSelect`; a second call while one is
 * under way does nothing. A create that never answers fails after the send timeout. A failed create stays said until the reader picks or tries again.
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
  const goneRef = useRef(false);
  const tokenRef = useRef(Symbol("entry-create"));
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

  useEffect(() => {
    const token = tokenRef.current;

    goneRef.current = false;

    return () => {
      goneRef.current = true;
      track(token, false);
    };
  }, []);

  const pick = (entry: PickerEntry) => {
    setFailedName(null);
    selectRef.current(entry);
  };

  const createAndSelect = async () => {
    if (offer.kind !== "create" || isOffline || underWayRef.current) return;

    underWayRef.current = true;
    setFailedName(null);
    track(tokenRef.current, true);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const noAnswer = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), MUTATION_SEND_TIMEOUT_MS);
    });
    const added = await Promise.race([
      answered(add.mutateAsync({ kind, name: offer.name, recipeId })),
      noAnswer,
    ]);

    clearTimeout(timer);
    underWayRef.current = false;
    track(tokenRef.current, false);

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

    // A picker that has gone must not write its old selection over a newer one.
    if (!goneRef.current) pick(added.entry);
  };

  return {
    ...view,
    /** The "Create" row is offered but cannot be taken: offline, or while one is being made. */
    createDisabled: isOffline || (add.isPending && !failedName),
    pick,
    createAndSelect,
    retryList: retry,
  };
}
