"use client";

import React from "react";
import { Card, CardBody, CardHeader, Divider, Skeleton } from "@heroui/react";
import { useTranslations, useLocale } from "next-intl";
import { SparklesIcon } from "@heroicons/react/16/solid";

import { useRecipeContextRequired } from "../context";

import { cssAIIconColor } from "@/config/css-tokens";

export function RecipeProvenance({ variant = "card" }: { variant?: "card" | "section" }) {
  const t = useTranslations("recipes.detail.provenance");
  const locale = useLocale();
  const { recipe, isInferringProvenance } = useRecipeContextRequired();

  const hasData = !!(recipe.originCountry || recipe.originRegion || (recipe.cuisines?.length ?? 0) > 0);

  if (!hasData && !isInferringProvenance) {
    return null;
  }

  // Country Flag Emoji Helper
  const getFlagEmoji = (countryCode: string) => {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  let displayCountry = recipe.originCountry;
  if (recipe.originCountry) {
    try {
      displayCountry =
        new Intl.DisplayNames([locale], { type: "region" }).of(recipe.originCountry) ||
        recipe.originCountry;
    } catch (e) {
      // fallback
    }
  }

  const cuisinesList = (recipe.cuisines || []).map((c: any) => t(`cuisines.${c}`));
  const displayCuisines = cuisinesList.join(", ");

  const content = isInferringProvenance && !hasData ? (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16 rounded-lg" />
          <Skeleton className="h-6 w-32 rounded-lg" />
        </div>
        <div className="flex flex-col gap-2 pl-4">
          <Skeleton className="h-4 w-20 rounded-lg" />
          <Skeleton className="h-6 w-24 rounded-lg" />
        </div>
      </div>
      <Divider className="bg-default-100" />
      <Skeleton className="h-4 w-3/4 rounded-lg mt-2" />
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {/* Inferring state is now handled solely by the header icon */}

        {recipe.originCountry && (
          <div className="flex flex-col">
            <span className="text-default-400 text-xs font-medium tracking-wider uppercase">
              {t("origin")}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl" role="img" aria-label={displayCountry ?? ""}>
                {getFlagEmoji(recipe.originCountry)}
              </span>
              <span className="text-base font-semibold">{displayCountry}</span>
            </div>
          </div>
        )}

        {recipe.originRegion && (
          <div className="border-default-200 flex flex-col border-l-1 pl-4">
            <span className="text-default-400 text-xs font-medium tracking-wider uppercase">
              {t("subRegion")}
            </span>
            <span className="text-base font-semibold">{recipe.originRegion}</span>
          </div>
        )}

        {(recipe.cuisines?.length ?? 0) > 0 && (
          <div className="border-default-200 flex flex-col border-l-1 pl-4">
            <span className="text-default-400 text-xs font-medium tracking-wider uppercase">
              {t("cuisine")}
            </span>
            <span className="text-base font-semibold">{displayCuisines}</span>
          </div>
        )}
      </div>

      {recipe.provenanceNote && (
        <>
          <Divider className="bg-default-100" />
          <div className="mt-2 flex flex-col gap-1.5">
            <p className="text-default-600 text-sm leading-relaxed italic">
              &quot;{recipe.provenanceNote}&quot;
            </p>
          </div>
        </>
      )}
    </div>
  );

  const header = (
    <div className="flex items-center gap-2">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      {isInferringProvenance && (
        <SparklesIcon className={`h-4 w-4 animate-spin ${cssAIIconColor} ml-1`} />
      )}
    </div>
  );

  if (variant === "section") {
    return (
      <>
        <Divider />
        <div className="space-y-4">
          {header}
          <div className="-mx-1 px-1">{content}</div>
        </div>
      </>
    );
  }

  return (
    <Card className="bg-content1 border-primary/20 rounded-2xl border-1 shadow-md">
      <CardHeader className="flex items-center justify-between px-6 pt-6 pb-2">{header}</CardHeader>
      <CardBody className="p-6 pt-2">{content}</CardBody>
    </Card>
  );
}
