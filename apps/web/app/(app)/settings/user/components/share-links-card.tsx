"use client";

import ShareLinksTableCard from "@/components/recipes/share-links-table-card";
import { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";

export default function ShareLinksCard() {
  const { shares, isLoading } = sharedRecipeShareHooks.useMyRecipeSharesQuery();

  return (
    <ShareLinksTableCard
      isLoading={isLoading}
      namespace="settings.user.shareLinks"
      shares={shares}
    />
  );
}
