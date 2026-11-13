"use client";

import { useEffect } from "react";

import type {
  CanonicalRecipeFilters,
  PersistedRecipeFilters,
} from "@norish/shared/contracts/filter-contract";
import { normalizePersistedRecipeFilters } from "@norish/shared/contracts/filter-contract";

import type { PlatformStorage } from "../platform";
import { useLibraryFiltersStoreApi } from "./library-filters-store";

export const RECIPE_FILTERS_STORAGE_KEY = "norish:recipe-filters";

/** A stored copy of the Library filters; null when there is none or it doesn't parse. */
export function parseStoredRecipeFilters(raw: string | null): PersistedRecipeFilters | null {
  try {
    return raw ? normalizePersistedRecipeFilters(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Applies the device's stored filters to the Library's store, then writes every change back.
 * `resumed` stores already hold this document's own filters, so storage is not read for them.
 * `onKeep` is the platform's extra copy (web's cookie for the server render).
 */
export function useLibraryFiltersPersistence({
  storage,
  resumed,
  onKeep,
}: {
  storage: PlatformStorage;
  resumed: boolean;
  onKeep?: (filters: CanonicalRecipeFilters) => void;
}) {
  const store = useLibraryFiltersStoreApi();

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const keep = ({ rawInput: _rawInput, ...filters }: CanonicalRecipeFilters) => {
      void storage.setItem(RECIPE_FILTERS_STORAGE_KEY, JSON.stringify(filters));
      onKeep?.({ rawInput: _rawInput, ...filters });
    };
    // Writing before the stored filters apply would replace them with the defaults.
    const start = () => {
      keep(store.getState().filters);
      unsubscribe = store.subscribe((state, previous) => {
        if (state.filters !== previous.filters) keep(state.filters);
      });
    };
    const applyThenStart = (raw: string | null) => {
      if (cancelled) return;
      store.getState().applyStored(parseStoredRecipeFilters(raw));
      start();
    };

    if (resumed) {
      start();
    } else {
      // A synchronous storage applies within this effect, so the first frame is not held a tick.
      const raw = storage.getItem(RECIPE_FILTERS_STORAGE_KEY);

      if (raw instanceof Promise) void raw.then(applyThenStart);
      else applyThenStart(raw);
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [store, storage, resumed, onKeep]);
}
