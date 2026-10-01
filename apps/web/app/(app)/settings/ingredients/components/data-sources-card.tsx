"use client";

import type { ReactNode } from "react";
import { ArrowDownTrayIcon, CircleStackIcon } from "@heroicons/react/24/outline";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org";
const ODBL_URL = "https://opendatacommons.org/licenses/odbl/1-0/";
const CIQUAL_URL = "https://ciqual.anses.fr";
const USDA_URL = "https://fdc.nal.usda.gov";
const COFID_URL =
  "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid";

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
 * Where the ingredient catalogue comes from (ADR-0038): Open Food Facts'
 * taxonomy, under the ODbL, which asks for this credit and for the derived
 * catalogue to be offered as data — hence the download, for every member.
 * Ingredient Nutrition's datasets are credited beside it (ADR-0039), as their
 * terms ask: CIQUAL and CALNUT by source and edition.
 */
export default function DataSourcesCard() {
  const t = useTranslations("settings.ingredients.dataSources");

  return (
    <Card data-testid="data-sources">
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CircleStackIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">
          {t.rich("notice", {
            off: (chunks) => <ExternalLink href={OPEN_FOOD_FACTS_URL}>{chunks}</ExternalLink>,
            odbl: (chunks) => <ExternalLink href={ODBL_URL}>{chunks}</ExternalLink>,
          })}
        </p>
        <p className="text-muted text-base" data-testid="nutrition-sources">
          {t.rich("nutritionNotice", {
            ciqual: (chunks) => <ExternalLink href={CIQUAL_URL}>{chunks}</ExternalLink>,
            usda: (chunks) => <ExternalLink href={USDA_URL}>{chunks}</ExternalLink>,
            cofid: (chunks) => <ExternalLink href={COFID_URL}>{chunks}</ExternalLink>,
          })}
        </p>
        <a
          download
          className="text-accent inline-flex items-center gap-2 self-start text-sm font-medium hover:underline"
          data-testid="catalogue-export"
          href="/export/ingredients"
        >
          <ArrowDownTrayIcon aria-hidden className="h-4 w-4" />
          {t("download")}
        </a>
      </Card.Content>
    </Card>
  );
}
