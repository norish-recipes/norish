"use client";

import { sharedAdminHooks } from "./shared-admin-hooks";

export const useAdminMutations = sharedAdminHooks.useAdminMutations;

export type { AdminMutationsResult } from "@norish/shared-react/hooks";
