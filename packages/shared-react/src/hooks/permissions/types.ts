import type { inferRouterOutputs } from "@trpc/server";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type {
  AutoTaggingMode,
  PermissionLevel,
  RecipePermissionPolicy,
} from "@norish/config/zod/server-config";
import type { AppRouter } from "@norish/trpc/client";

type PermissionsOutputs = inferRouterOutputs<AppRouter>["permissions"];
type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;

export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;
export type PermissionsData = PermissionsOutputs["get"];

export interface NormalizedPermissionsData {
  recipePolicy: RecipePermissionPolicy;
  isAIEnabled: boolean;
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
  autoTaggingMode: AutoTaggingMode;
}

export interface PermissionAccessInput {
  policyLevel: PermissionLevel;
  userId: string;
  ownerId: string;
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
}

export interface CreatePermissionsHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
