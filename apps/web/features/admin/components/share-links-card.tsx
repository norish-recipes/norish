"use client";

import ShareLinksTableCard from "@/components/settings/share-links-table-card";

import { useAdminRecipeSharesQuery } from "@norish/shared-react/recipes";

export default function AdminShareLinksCard() {
  const { shares, isLoading } = useAdminRecipeSharesQuery();

  return (
    <ShareLinksTableCard
      showOwner
      isLoading={isLoading}
      namespace="settings.admin.shareLinks"
      shares={shares}
    />
  );
}
