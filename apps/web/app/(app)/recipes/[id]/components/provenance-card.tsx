"use client";

import { useMemo } from "react";
import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import { Card, Chip, Separator, Skeleton } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import {
  countryCodeToFlagEmoji,
  getLocalizedCountryName,
  recipeHasProvenance,
} from "@norish/shared/lib/provenance";

function ProvenanceDisplay({ inCard = true }: { inCard?: boolean }) {
  const { recipe, isInferringProvenance } = useRecipeContext();
  const t = useTranslations("recipes.provenance");
  const locale = useLocale();

  const provenance = useMemo(() => {
    if (!recipe) return null;

    // The recipe cache can briefly hold a dashboard DTO (which omits provenance)
    // right after import, so read every field defensively.
    const originCountryCode = recipe.originCountryCode ?? null;
    const region = recipe.region ?? null;
    const cuisines = recipe.cuisines ?? [];
    const note = recipe.provenanceNote ?? null;
    const flag = countryCodeToFlagEmoji(originCountryCode);
    const countryName = getLocalizedCountryName(originCountryCode, locale);
    const hasData = recipeHasProvenance(recipe);

    return { flag, countryName, region, cuisines, note, hasData };
  }, [recipe, locale]);

  if (!provenance) return null;

  // Nothing to show and nothing running (idle / terminal-without-result):
  // stay out of the way — provenance is an optional enhancement.
  if (!isInferringProvenance && !provenance.hasData) return null;

  const content = (
    <>
      <div className={`flex items-center justify-between ${inCard ? "mb-3" : ""}`}>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>

      {isInferringProvenance && !provenance.hasData ? (
        <div
          aria-live="polite"
          className="flex items-center gap-3"
          role="status"
        >
          <Skeleton className="h-6 w-10 rounded-md" />
          <Skeleton className="h-4 w-40 rounded-md" />
          <span className="sr-only">{t("pending")}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {isInferringProvenance && (
            <p aria-live="polite" className="text-muted text-sm" role="status">
              {t("updating")}
            </p>
          )}

          {provenance.countryName && (
            <p className="text-foreground text-base font-semibold">
              {provenance.flag && <span aria-hidden="true">{provenance.flag} </span>}
              {provenance.countryName}
            </p>
          )}

          {provenance.region && (
            <p className="text-muted text-sm">
              <span className="font-medium">{t("regionLabel")}:</span> {provenance.region}
            </p>
          )}

          {provenance.cuisines.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted text-sm font-medium">{t("cuisinesLabel")}:</span>
              {provenance.cuisines.map((cuisine) => (
                <Chip key={cuisine} size="sm" variant="flat">
                  {cuisine}
                </Chip>
              ))}
            </div>
          )}

          {provenance.note && <p className="text-base leading-relaxed">{provenance.note}</p>}

          <p className="text-muted text-xs italic">{t("aiInferred")}</p>
        </div>
      )}
    </>
  );

  return inCard ? (
    <Card className="rounded-2xl">
      <Card.Content className="p-5">{content}</Card.Content>
    </Card>
  ) : (
    <>
      <Separator />
      <div className="space-y-2">{content}</div>
    </>
  );
}

export function ProvenanceSection() {
  return <ProvenanceDisplay inCard={false} />;
}

export default function ProvenanceCard() {
  return <ProvenanceDisplay inCard={true} />;
}
