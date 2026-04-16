"use client";

import { sharedStoresHooks } from "./shared-stores-hooks";

export const useStoresQuery = sharedStoresHooks.useStoresQuery;

export type { StoresData, StoresQueryResult } from "@norish/shared-react/hooks";
