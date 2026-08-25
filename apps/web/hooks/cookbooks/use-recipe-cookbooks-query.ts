"use client";

import { sharedCookbookHooks } from "./shared-cookbook-hooks";

export const useRecipeCookbooksQuery = sharedCookbookHooks.useRecipeCookbooksQuery;
export const useEditableCookbooksQuery = sharedCookbookHooks.useEditableCookbooksQuery;

export type {
  EditableCookbooksQueryResult,
  RecipeCookbooksQueryResult,
} from "@norish/shared-react/hooks";
