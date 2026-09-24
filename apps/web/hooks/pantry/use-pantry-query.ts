"use client";

import { sharedPantryHooks } from "./shared-pantry-hooks";

export const usePantryQuery = sharedPantryHooks.usePantryQuery;

export type { PantryData, PantryQueryResult } from "@norish/shared-react/hooks";
