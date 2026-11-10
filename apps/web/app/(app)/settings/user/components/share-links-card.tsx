"use client";

import ShareLinksTableCard from "@/components/recipes/share-links-table-card";

import { useMyRecipeSharesQuery } from "@norish/shared-react/recipes";

export default function ShareLinksCard() {
  const { shares, isLoading } = useMyRecipeSharesQuery();

  return (
    <ShareLinksTableCard
      isLoading={isLoading}
      namespace="settings.user.shareLinks"
      shares={shares}
    />
  );
}
