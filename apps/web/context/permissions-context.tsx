"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useUserContext } from "@/context/user-context";
import { usePermissionsQuery } from "@/hooks/permissions";

import type {
  AutoTaggingMode,
  PermissionLevel,
  RecipePermissionPolicy,
} from "@norish/config/zod/server-config";

interface PermissionsContextValue {
  /** Recipe permission policy */
  recipePolicy: RecipePermissionPolicy | null;
  /** Whether AI features are enabled */
  isAIEnabled: boolean;
  /** Household member user IDs (null if not in a household) */
  householdUserIds: string[] | null;
  /** Whether the current user is a server admin */
  isServerAdmin: boolean;
  /** Auto-tagging mode setting */
  autoTaggingMode: AutoTaggingMode;
  /** Whether auto-tagging is enabled (not disabled) */
  isAutoTaggingEnabled: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Check if current user can view a recipe */
  canViewRecipe: (ownerId: string) => boolean;
  /** Check if current user can edit a recipe */
  canEditRecipe: (ownerId: string) => boolean;
  /** Check if current user can delete a recipe */
  canDeleteRecipe: (ownerId: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

/**
 * Check if user can access based on policy level
 */
function checkAccess(
  policyLevel: PermissionLevel,
  userId: string,
  ownerId: string,
  householdUserIds: string[] | null,
  isServerAdmin: boolean
): boolean {
  // Owner always has access
  if (userId === ownerId) return true;

  // Server admin always has access
  if (isServerAdmin) return true;

  switch (policyLevel) {
    case "everyone":
      return true;

    case "household":
      // Must share a household with owner
      if (!householdUserIds) return false;

      return householdUserIds.includes(ownerId);

    case "owner":
      // Only owner (already checked above)
      return false;

    default:
      return false;
  }
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUserContext();
  const { data, isLoading: isLoadingPermissions } = usePermissionsQuery();
  const userId = user?.id;

  const canViewRecipe = useCallback(
    (ownerId: string): boolean => {
      if (!userId || !data) return false;

      return checkAccess(
        data.recipePolicy.view,
        userId,
        ownerId,
        data.householdUserIds,
        data.isServerAdmin
      );
    },
    [userId, data]
  );

  const canEditRecipe = useCallback(
    (ownerId: string): boolean => {
      if (!userId || !data) return false;

      return checkAccess(
        data.recipePolicy.edit,
        userId,
        ownerId,
        data.householdUserIds,
        data.isServerAdmin
      );
    },
    [userId, data]
  );

  const canDeleteRecipe = useCallback(
    (ownerId: string): boolean => {
      if (!userId || !data) return false;

      return checkAccess(
        data.recipePolicy.delete,
        userId,
        ownerId,
        data.householdUserIds,
        data.isServerAdmin
      );
    },
    [userId, data]
  );

  const value = useMemo<PermissionsContextValue>(
    () => ({
      recipePolicy: data?.recipePolicy ?? null,
      isAIEnabled: data?.isAIEnabled ?? false,
      householdUserIds: data?.householdUserIds ?? null,
      isServerAdmin: data?.isServerAdmin ?? false,
      autoTaggingMode: data?.autoTaggingMode ?? "disabled",
      isAutoTaggingEnabled: data?.autoTaggingMode !== "disabled",
      isLoading: isLoadingPermissions,
      canViewRecipe,
      canEditRecipe,
      canDeleteRecipe,
    }),
    [data, isLoadingPermissions, canViewRecipe, canEditRecipe, canDeleteRecipe]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissionsContext(): PermissionsContextValue {
  const context = useContext(PermissionsContext);

  if (!context) {
    throw new Error("usePermissionsContext must be used within PermissionsProvider");
  }

  return context;
}
