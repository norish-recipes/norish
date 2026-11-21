"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** What Search offers with no text: Categories with a photo, and the most-used Tags. */
export function useLibraryDiscover() {
  const trpc = useTRPC();

  return useQuery(trpc.library.discover.queryOptions());
}
