"use client";

import { CellSlot, EmptyState } from "@/components/shared/empty-state";
import { CpuChipIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

/** Why a model list came back empty, in parts this component phrases. */
export type ListingRefusal = {
  provider: string;
  status?: number;
  statusText?: string;
};

interface ModelListingEmptyStateProps {
  isLoading: boolean;
  refusal?: ListingRefusal;
}

/** An empty model dropdown says whether nothing was asked yet or the provider refused the key. */
export default function ModelListingEmptyState({
  isLoading,
  refusal,
}: ModelListingEmptyStateProps) {
  const t = useTranslations("settings.admin.modelListing");

  if (isLoading) {
    return (
      <CellSlot>
        <Spinner size="sm" />
      </CellSlot>
    );
  }

  if (!refusal) {
    return <EmptyState icon={CpuChipIcon} title={t("empty")} variant="cell" />;
  }

  return (
    <EmptyState
      icon={ExclamationCircleIcon}
      title={
        refusal.status
          ? t("refused", {
              provider: refusal.provider,
              status: refusal.statusText
                ? `${refusal.status} ${refusal.statusText}`
                : `${refusal.status}`,
            })
          : t("unreachable", { provider: refusal.provider })
      }
      variant="cell"
    />
  );
}
