"use client";

import { sharedCookbookHooks } from "./shared-cookbook-hooks";

export const useCookbooksQuery = sharedCookbookHooks.useCookbooksQuery;

export type { CookbookFilters, CookbooksQueryResult } from "@norish/shared-react/hooks";
