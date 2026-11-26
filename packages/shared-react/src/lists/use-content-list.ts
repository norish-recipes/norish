"use client";

import { useState } from "react";

import type { PickerKind } from "./entry-matching";
import { useConnectivity } from "../offline/react";
import { contentListView } from "./content-view";
import { useListEntries } from "./use-list-entries";

/**
 * One list of the Content page: the household's entries and the server's, searched on the fold,
 * with the unused filter. `view.state` says why nothing shows; `failed` is a first read that failed.
 */
export function useContentList(kind: PickerKind) {
  const { entries, loaded, failed, retry } = useListEntries(kind);
  const { isOffline } = useConnectivity();
  const [search, setSearch] = useState("");
  const [unusedOnly, setUnusedOnly] = useState(false);

  return {
    entries,
    loaded,
    failed,
    retry,
    offline: isOffline,
    search,
    setSearch,
    unusedOnly,
    setUnusedOnly,
    view: contentListView(kind, entries, search, unusedOnly),
  };
}

/** How many entries each list has, once read: the Content page's list picker shows them. */
export function useContentCounts() {
  const tags = useListEntries("tag");
  const cuisines = useListEntries("cuisine");
  const categories = useListEntries("category");

  return {
    tag: tags.loaded ? tags.entries.length : undefined,
    cuisine: cuisines.loaded ? cuisines.entries.length : undefined,
    category: categories.loaded ? categories.entries.length : undefined,
  } satisfies Record<PickerKind, number | undefined>;
}
