"use client";

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

/**
 * What a model dropdown says when it has nothing to offer.
 *
 * "Nothing to ask with yet" and "the provider rejected the key" both arrive as
 * an empty list, and only one of them is the reader's to fix. Saying which
 * happened is the difference between a setting that looks broken and one that
 * says what to do about it.
 */
export default function ModelListingEmptyState({
  isLoading,
  refusal,
}: ModelListingEmptyStateProps) {
  const t = useTranslations("settings.admin.modelListing");

  if (isLoading) {
    return (
      <div className="flex justify-center py-2">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!refusal) {
    return <div className="text-muted px-2 py-2 text-xs">{t("empty")}</div>;
  }

  return (
    <div className="text-danger px-2 py-2 text-xs">
      {refusal.status
        ? t("refused", {
            provider: refusal.provider,
            status: refusal.statusText
              ? `${refusal.status} ${refusal.statusText}`
              : `${refusal.status}`,
          })
        : t("unreachable", { provider: refusal.provider })}
    </div>
  );
}
