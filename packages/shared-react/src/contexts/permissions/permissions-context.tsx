import { createContext, useCallback, useContext, useMemo } from "react";

import type { AutoTaggingMode, RecipePermissionPolicy } from "@norish/config/zod/server-config";

import type { PermissionsData } from "../../hooks/permissions/types";
import {
  normalizePermissionsData,
  selectCanDeleteRecipe,
  selectCanEditRecipe,
  selectCanViewRecipe,
  selectIsAutoTaggingEnabled,
} from "../../hooks/permissions/selectors";

export interface PermissionsContextValue {
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

type CreatePermissionsContextOptions = {
  /** Hook that returns the current user's ID, or undefined if not authenticated */
  useCurrentUserId: () => string | undefined;
  /** Hook that returns the permissions query result */
  usePermissionsQuery: () => { data: PermissionsData | undefined; isLoading: boolean };
};

export function createPermissionsContext({
  useCurrentUserId,
  usePermissionsQuery,
}: CreatePermissionsContextOptions) {
  const PermissionsContext = createContext<PermissionsContextValue | null>(null);

  function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const userId = useCurrentUserId();
    const { data, isLoading: isLoadingPermissions } = usePermissionsQuery();
    const normalized = useMemo(() => normalizePermissionsData(data), [data]);

    const canViewRecipe = useCallback(
      (ownerId: string): boolean => {
        if (!userId || !data) return false;

        return selectCanViewRecipe(normalized, userId, ownerId);
      },
      [userId, data, normalized]
    );

    const canEditRecipe = useCallback(
      (ownerId: string): boolean => {
        if (!userId || !data) return false;

        return selectCanEditRecipe(normalized, userId, ownerId);
      },
      [userId, data, normalized]
    );

    const canDeleteRecipe = useCallback(
      (ownerId: string): boolean => {
        if (!userId || !data) return false;

        return selectCanDeleteRecipe(normalized, userId, ownerId);
      },
      [userId, data, normalized]
    );

    const value = useMemo<PermissionsContextValue>(
      () => ({
        recipePolicy: data?.recipePolicy ?? null,
        isAIEnabled: data?.isAIEnabled ?? false,
        householdUserIds: data?.householdUserIds ?? null,
        isServerAdmin: data?.isServerAdmin ?? false,
        autoTaggingMode: data?.autoTaggingMode ?? "disabled",
        isAutoTaggingEnabled: selectIsAutoTaggingEnabled(normalized),
        isLoading: isLoadingPermissions,
        canViewRecipe,
        canEditRecipe,
        canDeleteRecipe,
      }),
      [data, normalized, isLoadingPermissions, canViewRecipe, canEditRecipe, canDeleteRecipe]
    );

    return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
  }

  function usePermissionsContext(): PermissionsContextValue {
    const context = useContext(PermissionsContext);

    if (!context) {
      throw new Error("usePermissionsContext must be used within PermissionsProvider");
    }

    return context;
  }

  return {
    PermissionsProvider,
    usePermissionsContext,
  };
}
