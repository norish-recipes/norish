"use client";

import type { BulkImportTrackerItem } from "@/context/bulk-import-state";
import Image from "next/image";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Button, Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

type ImportingRecipeCardProps = {
  item: BulkImportTrackerItem;
  variant: RecipeViewMode;
  onRetry: (items: readonly BulkImportTrackerItem[]) => void;
};

export default function ImportingRecipeCard({ item, variant, onRetry }: ImportingRecipeCardProps) {
  const t = useTranslations("recipes.bulkImport");
  const isFailed = item.status === "failed";
  const statusText = isFailed
    ? t(`error.${item.errorCode ?? "extraction-failed"}`)
    : t(`status.${item.status}`);

  const preview = item.previewUrl ? (
    <Image
      fill
      unoptimized
      alt=""
      className="object-cover"
      sizes="(max-width: 640px) 50vw, 25vw"
      src={item.previewUrl}
    />
  ) : (
    <div className="bg-default flex h-full w-full items-center justify-center">
      <PhotoIcon aria-hidden className="text-muted h-10 w-10" />
    </div>
  );

  const status = (
    <p
      aria-live="polite"
      className={isFailed ? "text-danger mt-1 text-xs" : "text-muted mt-1 text-xs"}
      role="status"
    >
      {statusText}
    </p>
  );

  if (variant === "list") {
    return (
      <Card
        className="h-[128px] w-full gap-0 overflow-hidden rounded-2xl p-0"
        data-testid="importing-recipe-card"
      >
        <div className="flex h-full min-w-0 items-stretch">
          <div className="relative h-full w-[112px] shrink-0 overflow-hidden">{preview}</div>
          <Card.Content className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
            <p className="truncate text-sm font-semibold" title={item.filename}>
              {item.filename}
            </p>
            {status}
            {isFailed ? (
              <Button
                className="mt-2 self-start"
                size="sm"
                variant="secondary"
                onPress={() => onRetry([item])}
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                {t("retry")}
              </Button>
            ) : null}
          </Card.Content>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="h-[286px] w-full gap-0 overflow-hidden rounded-3xl p-0 sm:h-[378px]"
      data-testid="importing-recipe-card"
    >
      <div className="relative h-40 w-full overflow-hidden sm:h-[236px]">{preview}</div>
      <Card.Content className="h-[124px] px-3 pt-2.5 pb-3 sm:h-[140px] sm:px-4 sm:pt-3">
        <p className="truncate text-sm font-semibold" title={item.filename}>
          {item.filename}
        </p>
        {status}
        {isFailed ? (
          <Button className="mt-2" size="sm" variant="secondary" onPress={() => onRetry([item])}>
            <ArrowPathIcon className="h-3.5 w-3.5" />
            {t("retry")}
          </Button>
        ) : null}
      </Card.Content>
    </Card>
  );
}
