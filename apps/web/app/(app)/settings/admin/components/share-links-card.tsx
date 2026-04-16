"use client";

import ShareLinksTableCard from "@/components/recipes/share-links-table-card";
import { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";

export default function AdminShareLinksCard() {
  const { shares, isLoading } = sharedRecipeShareHooks.useAdminRecipeSharesQuery();

  return (
    <ShareLinksTableCard
      showOwner
      isLoading={isLoading}
      namespace="settings.admin.shareLinks"
      shares={shares}
    />
  );
}
