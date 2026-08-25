"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createUseLibraryQuery } from "@norish/shared-react/hooks";

export const useLibraryQuery = createUseLibraryQuery({ useTRPC });

export type { LibraryFilters, LibraryQueryResult } from "@norish/shared-react/hooks";
