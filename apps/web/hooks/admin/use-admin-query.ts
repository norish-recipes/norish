"use client";

import { sharedAdminHooks } from "./shared-admin-hooks";

export const useAdminConfigsQuery = sharedAdminHooks.useAdminConfigsQuery;
export const useAvailableModelsQuery = sharedAdminHooks.useAvailableModelsQuery;
export const useAvailableTranscriptionModelsQuery =
  sharedAdminHooks.useAvailableTranscriptionModelsQuery;
export const useYtDlpVersionQuery = sharedAdminHooks.useYtDlpVersionQuery;

export type { AdminConfigsData } from "@norish/shared-react/hooks";
