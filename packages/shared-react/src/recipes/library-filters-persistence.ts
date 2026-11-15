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

/** The stored copy, read from a synchronous or asynchronous storage; the defaults when it throws. */
export function readStoredRecipeFilters(
  storage: PlatformStorage
): PersistedRecipeFilters | null | Promise<PersistedRecipeFilters | null> {
  try {
    const raw = storage.getItem(RECIPE_FILTERS_STORAGE_KEY);

    return raw instanceof Promise
      ? raw.then(parseStoredRecipeFilters, () => null)
      : parseStoredRecipeFilters(raw);
  } catch {
    return null;
  }
}

/** Applies the device's stored filters to the Library's store and writes changes back, skipping the
 * read for `resumed` stores; `onKeep` is the platform's extra copy, which web strips for the cookie. */
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
    const applyThenStart = (stored: PersistedRecipeFilters | null) => {
      if (cancelled) return;
      store.getState().applyStored(stored);
      start();
    };

    if (resumed) {
      start();
    } else {
      // A synchronous storage applies within this effect, so the first frame is not held a tick.
      const stored = readStoredRecipeFilters(storage);

      if (stored instanceof Promise) void stored.then(applyThenStart);
      else applyThenStart(stored);
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [store, storage, resumed, onKeep]);
}
