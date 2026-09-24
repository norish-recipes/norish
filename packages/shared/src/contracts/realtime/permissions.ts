/**
 * Permissions realtime catalogue. A policy change concerns every connected
 * client, so it is a broadcast.
 */

import { z } from "zod";

import { RecipePermissionPolicySchema } from "@norish/config/zod/server-config";

import { defineRealtimeCatalogue } from "./catalogue";

export const permissionsRealtime = defineRealtimeCatalogue("permissions", {
  policyUpdated: {
    scope: "broadcast",
    payload: z.object({ recipePolicy: RecipePermissionPolicySchema }),
  },
});

export type PermissionsRealtime = typeof permissionsRealtime;
