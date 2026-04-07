export function canShowAIAction(options: {
  isAIEnabled: boolean;
  isLoadingPermissions: boolean;
}): boolean {
  return options.isAIEnabled && !options.isLoadingPermissions;
}

export function canShowDeleteAction(options: {
  ownerId: string | null;
  isLoadingPermissions: boolean;
  canDeleteRecipe: (ownerId: string) => boolean;
}): boolean {
  if (options.isLoadingPermissions || !options.ownerId) {
    return false;
  }

  return options.canDeleteRecipe(options.ownerId);
}
