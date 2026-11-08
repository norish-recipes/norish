"use client";

import { createUseLibraryQuery } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const useLibraryQuery = createUseLibraryQuery({ useTRPC });

export type { LibraryFilters, LibraryQueryResult } from "@norish/shared-react/hooks";
