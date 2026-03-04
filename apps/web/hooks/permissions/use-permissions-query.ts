"use client";

import type { PermissionsData } from "@norish/shared-react/hooks";

import { sharedPermissionsHooks } from "./shared-permissions-hooks";

export type { PermissionsData };

export function usePermissionsQuery() {
  return sharedPermissionsHooks.usePermissionsQuery();
}
