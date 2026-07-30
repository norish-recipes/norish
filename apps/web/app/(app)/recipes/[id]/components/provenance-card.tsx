"use client";

import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import { Card, Chip, Separator, Skeleton } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { hasSubstantiveProvenance } from "@norish/shared/lib/recipe-enrichment";
import { countryDisplayName, countryFlagEmoji } from "@norish/shared/lib/recipe-provenance";

/**
 * Recipe Provenance on the recipe page.
 *
 * The country is localised at render time from the stored alpha-2 code; the
 * region and the note are shown exactly as stored, because they are recipe
 * content in the recipe's own language and are never translated.
 *
 * The section is absent entirely when there is nothing to show and nothing in
 * flight, so a recipe that will never have provenance shows nothing at all.
 * Asking for a run lives in the actions menu, alongside every other kind.
 */
function ProvenanceDisplay({ inCard = true }: { inCard?: boolean }) {
  const { recipe, enrichment } = useRecipeContext();
  const locale = useLocale();
  const t = useTranslations("recipes.provenance");
  const tEnrichment = useTranslations("recipes.enrichment");

  // Queued and processing both read as "working"; a quiet automatic failure
  // simply leaves the section showing whatever is stored.
  const isInferring = enrichment.isBusy("recipe-provenance");
  const enrichmentState = enrichment.states["recipe-provenance"];

  if (!recipe) return null;

  // Nothing stored and nothing running: show nothing, so a recipe that will
  // never have provenance carries no empty panel.
  if (!hasSubstantiveProvenance(recipe) && !isInferring) return null;

  const flag = countryFlagEmoji(recipe.originCountry);
  const country = countryDisplayName(recipe.originCountry, locale);

  const content = (
    <>
      <div className={`flex items-center justify-between ${inCard ? "mb-3" : ""}`}>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>
      {isInferring ? (
        <div className="space-y-2">
          <p className="text-muted pb-1 text-sm">{tEnrichment(`states.${enrichmentState}`)}</p>
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {country && (
            <div className="flex items-center gap-2">
              {flag && (
                <span aria-hidden="true" className="text-2xl leading-none">
                  {flag}
                </span>
              )}
              <span className="text-base font-semibold">{country}</span>
            </div>
          )}
          {recipe.originRegion && (
            <div className="flex items-baseline gap-2">
              <span className="text-muted text-sm">{t("region")}</span>
              <span className="text-base">{recipe.originRegion}</span>
            </div>
          )}
          {recipe.cuisines.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-muted text-sm">{t("cuisines")}</span>
              {recipe.cuisines.map((cuisine) => (
                <Chip key={cuisine.id} size="sm" variant="soft">
                  {/* A canonical identifier: shown verbatim in every locale. */}
                  {cuisine.name}
                </Chip>
              ))}
            </div>
          )}
          {recipe.provenanceNote && (
            <p className="text-base leading-relaxed">{recipe.provenanceNote}</p>
          )}
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
