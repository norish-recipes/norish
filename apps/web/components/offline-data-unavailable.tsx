"use client";

import { useEffect } from "react";
import { useOfflineWeb } from "@/context/offline-web-context";
import { CloudIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

export function OfflineDataUnavailable({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const t = useTranslations("navbar.offline.unavailable");
  const { registerVisibleDataUnavailable } = useOfflineWeb();

  useEffect(() => registerVisibleDataUnavailable(), [registerVisibleDataUnavailable]);

  return (
    <div
      className="border-border bg-surface-secondary mx-auto flex min-h-48 w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border p-8 text-center"
      role="status"
    >
      <CloudIcon aria-hidden className="text-muted size-8" />
      <div>
        <p className="text-foreground font-semibold">{title ?? t("title")}</p>
        <p className="text-muted mt-1 text-sm">{description ?? t("description")}</p>
      </div>
    </div>
  );
}
