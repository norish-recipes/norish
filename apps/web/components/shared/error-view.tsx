"use client";

import { NoraCard } from "@/components/shared/nora-card";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

/** A page that could not be read: the error card, whose button tries again. */
export function ErrorView({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("common.errorPage");

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <NoraCard message={t("message")} title={t("title")}>
        <Button className="mt-4 rounded-lg px-6" variant="primary" onPress={onRetry}>
          <ArrowPathIcon className="h-4 w-4" />
          {t("retry")}
        </Button>
      </NoraCard>
    </div>
  );
}
