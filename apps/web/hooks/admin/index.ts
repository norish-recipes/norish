"use client";

import { sharedAdminHooks } from "./shared-admin-hooks";

export const useAdminConfigsQuery = sharedAdminHooks.useAdminConfigsQuery;
export const useUserRoleQuery = sharedAdminHooks.useUserRoleQuery;
export const useAvailableModelsQuery = sharedAdminHooks.useAvailableModelsQuery;
export const useAvailableTranscriptionModelsQuery =
  sharedAdminHooks.useAvailableTranscriptionModelsQuery;
export type { AdminConfigsData } from "@norish/shared-react/hooks";

export const useAdminMutations = sharedAdminHooks.useAdminMutations;
export type { AdminMutationsResult } from "@norish/shared-react/hooks";
