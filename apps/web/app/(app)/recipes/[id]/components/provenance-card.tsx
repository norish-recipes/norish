"use client";

import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import OriginFlag from "@/components/recipes/origin-flag";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { Card, Chip, Skeleton } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { hasSubstantiveProvenance } from "@norish/shared/lib/recipe-enrichment";
import { countryEndonym } from "@norish/shared/lib/recipe-provenance";

/**
 * Whether the Recipe Provenance section has anything to show: something
 * stored, or a run in flight. Queued and processing both read as "working";
 * a quiet automatic failure simply leaves the section showing whatever is
 * stored. A reader who has hidden Recipe Provenance sees no section at all,
 * even mid-run — hiding is a reading preference, and enrichment keeps
 * storing regardless. The page layouts read this too, so the rules they
 * draw between sections come from the same answer the section itself
 * renders by.
 */
export function useProvenanceSectionVisible(): boolean {
  const { recipe, enrichment } = useRecipeContext();
  const { showProvenance } = useHiddenItemVisibility();

  if (!recipe || !showProvenance) return false;

  return hasSubstantiveProvenance(recipe) || enrichment.isBusy("recipe-provenance");
}

/**
 * Recipe Provenance on the recipe page.
 *
 * The country is the card's own title, shown as its stored written name — the
 * name the inference wrote in the recipe's language, or the one a manual pick
 * stored in the editor's own words — so it reads in step with the note beside
 * it. Rows with a code but no stored name fall back to the endonym derived
 * from the code, converging as runs happen. The reader's-language name stays
 * on the flag's tooltip. Until there is a country — while a run is in flight,
 * or for a recipe that only has a region or a note — the card falls back to
 * naming itself. The region and the note are shown exactly as stored, because
 * they are recipe content in the recipe's own language and are never
 * translated.
 *
 * The section is absent entirely when there is nothing to show and nothing in
 * flight, so a recipe that will never have provenance shows nothing at all.
 * Asking for a run lives in the actions menu, alongside every other kind.
 */
function ProvenanceDisplay({ inCard = true }: { inCard?: boolean }) {
  const { recipe, enrichment } = useRecipeContext();
  const locale = useLocale();
  const t = useTranslations("recipes.provenance");
  const isVisible = useProvenanceSectionVisible();

  const isInferring = enrichment.isBusy("recipe-provenance");

  if (!recipe || !isVisible) return null;

  const country = isInferring
    ? null
    : (recipe.originCountryName ?? countryEndonym(recipe.originCountry, locale));

  const content = (
    <>
      <div className={`flex items-center justify-between ${inCard ? "mb-3" : ""}`}>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {!isInferring && <OriginFlag originCountry={recipe.originCountry} />}
          {country ?? t("title")}
        </h2>
      </div>
      {isInferring ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
                <Chip key={cuisine.id} size="sm" variant="tertiary">
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

  // As a section the display draws no rule of its own: the page owns the
  // rhythm between sections.
  return inCard ? (
    <Card className="rounded-2xl">
      <Card.Content className="p-5">{content}</Card.Content>
    </Card>
  ) : (
    <div className="space-y-2">{content}</div>
  );
}

export function ProvenanceSection() {
  return <ProvenanceDisplay inCard={false} />;
}

export default function ProvenanceCard() {
  return <ProvenanceDisplay inCard={true} />;
}
