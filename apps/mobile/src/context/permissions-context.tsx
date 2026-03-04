import React, { createContext, useCallback, useContext, useMemo } from 'react';

import { useAuth } from '@/context/auth-context';
import { usePermissionsQuery } from '@/hooks/permissions';

import type { AutoTaggingMode, RecipePermissionPolicy } from '@norish/config/zod/server-config';
import {
  normalizePermissionsData,
  selectCanDeleteRecipe,
  selectCanEditRecipe,
  selectCanViewRecipe,
  selectIsAutoTaggingEnabled,
} from '@norish/shared-react/hooks';

interface PermissionsContextValue {
  recipePolicy: RecipePermissionPolicy | null;
  isAIEnabled: boolean;
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
  autoTaggingMode: AutoTaggingMode;
  isAutoTaggingEnabled: boolean;
  isLoading: boolean;
  canViewRecipe: (ownerId: string) => boolean;
  canEditRecipe: (ownerId: string) => boolean;
  canDeleteRecipe: (ownerId: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data, isLoading: isLoadingPermissions } = usePermissionsQuery();
  const userId = user?.id;
  const normalized = useMemo(() => normalizePermissionsData(data), [data]);

  const canViewRecipe = useCallback(
    (ownerId: string): boolean => {
      if (!userId || !data) return false;

      return selectCanViewRecipe(normalized, userId, ownerId);
    },
    [data, normalized, userId],
  );

  const canEditRecipe = useCallback(
    (ownerId: string): boolean => {
      if (!userId || !data) return false;

      return selectCanEditRecipe(normalized, userId, ownerId);
    },
    [data, normalized, userId],
  );

  const canDeleteRecipe = useCallback(
    (ownerId: string): boolean => {
      if (!userId || !data) return false;

      return selectCanDeleteRecipe(normalized, userId, ownerId);
    },
    [data, normalized, userId],
  );

  const value = useMemo<PermissionsContextValue>(
    () => ({
      recipePolicy: data?.recipePolicy ?? null,
      isAIEnabled: data?.isAIEnabled ?? false,
      householdUserIds: data?.householdUserIds ?? null,
      isServerAdmin: data?.isServerAdmin ?? false,
      autoTaggingMode: data?.autoTaggingMode ?? 'disabled',
      isAutoTaggingEnabled: selectIsAutoTaggingEnabled(normalized),
      isLoading: isLoadingPermissions,
      canViewRecipe,
      canEditRecipe,
      canDeleteRecipe,
    }),
    [canDeleteRecipe, canEditRecipe, canViewRecipe, data, isLoadingPermissions, normalized],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissionsContext(): PermissionsContextValue {
  const context = useContext(PermissionsContext);

  if (!context) {
    throw new Error('usePermissionsContext must be used within PermissionsProvider');
  }

  return context;
}
