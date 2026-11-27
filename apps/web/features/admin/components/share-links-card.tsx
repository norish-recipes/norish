"use client";

import ShareLinksTableCard from "@/components/settings/share-links-table-card";

import {
  useAdminRecipeShareMutations,
  useAdminRecipeSharesQuery,
} from "@norish/shared-react/recipes";

export default function AdminShareLinksCard() {
  const { shares, isLoading } = useAdminRecipeSharesQuery();
  const mutations = useAdminRecipeShareMutations();

  return (
    <ShareLinksTableCard
      showOwner
      isLoading={isLoading}
      mutations={mutations}
      namespace="settings.admin.shareLinks"
      shares={shares}
    />
  );
}
