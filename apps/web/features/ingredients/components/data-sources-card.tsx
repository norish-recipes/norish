"use client";

import type { ReactNode } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ArrowDownTrayIcon, CircleStackIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { CATALOGUE_EXPORT_PATH, DATA_SOURCE_LINKS } from "@norish/shared-react/ingredients";
import { addBasePath } from "@norish/shared/lib/base-path";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="text-accent hover:underline"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

/**
 * The ODbL credit and download Open Food Facts' taxonomy asks for (ADR-0038), beside the nutrition
 * datasets' credits (ADR-0039).
 */
export default function DataSourcesCard() {
  const t = useTranslations("settings.ingredients.dataSources");

  return (
    <SettingsCard data-testid="data-sources" icon={CircleStackIcon} title={t("title")}>
      <p className="text-muted text-base">
        {t.rich("notice", {
          off: (chunks) => (
            <ExternalLink href={DATA_SOURCE_LINKS.notice.off}>{chunks}</ExternalLink>
          ),
          odbl: (chunks) => (
            <ExternalLink href={DATA_SOURCE_LINKS.notice.odbl}>{chunks}</ExternalLink>
          ),
        })}
      </p>
      <p className="text-muted text-base" data-testid="nutrition-sources">
        {t.rich("nutritionNotice", {
          ciqual: (chunks) => (
            <ExternalLink href={DATA_SOURCE_LINKS.nutritionNotice.ciqual}>{chunks}</ExternalLink>
          ),
          usda: (chunks) => (
            <ExternalLink href={DATA_SOURCE_LINKS.nutritionNotice.usda}>{chunks}</ExternalLink>
          ),
          cofid: (chunks) => (
            <ExternalLink href={DATA_SOURCE_LINKS.nutritionNotice.cofid}>{chunks}</ExternalLink>
          ),
        })}
      </p>
      <a
        download
        className="text-accent inline-flex items-center gap-2 self-start text-sm font-medium hover:underline"
        data-testid="catalogue-export"
        href={addBasePath(CATALOGUE_EXPORT_PATH)}
      >
        <ArrowDownTrayIcon aria-hidden className="h-4 w-4" />
        {t("download")}
      </a>
    </SettingsCard>
  );
}
