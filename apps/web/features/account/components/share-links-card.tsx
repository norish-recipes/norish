"use client";

import ShareLinksTableCard from "@/components/settings/share-links-table-card";

import { useMyRecipeSharesQuery, useRecipeShareMutations } from "@norish/shared-react/recipes";

export default function ShareLinksCard() {
  const { shares, isLoading } = useMyRecipeSharesQuery();
  const mutations = useRecipeShareMutations(null);

  return (
    <ShareLinksTableCard
      isLoading={isLoading}
      mutations={mutations}
      namespace="settings.user.shareLinks"
      shares={shares}
    />
  );
}
