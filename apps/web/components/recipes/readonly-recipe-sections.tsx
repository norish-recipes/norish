"use client";

import AuthorChip from "@/app/(app)/recipes/[id]/components/author-chip";
import MediaCarousel, { buildMediaItems } from "@/components/shared/media-carousel";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import {
  ArrowTopRightOnSquareIcon,
  CakeIcon,
  ClockIcon,
  FireIcon,
  MoonIcon,
  SunIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/16/solid";
import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeCategory } from "@norish/shared/contracts";
import {
  formatMinutesHM,
  isAllergenTag,
  sortTagsWithAllergyPriority,
} from "@norish/shared/lib/helpers";

type RecipeTagLike = { name: string };

type RecipeMediaLike = {
  image?: string | null;
  images?: Array<{ image: string; order?: number }>;
  videos?: Array<{
    video: string;
    thumbnail?: string | null;
    duration?: number | null;
    order: number;
  }>;
};

type RecipeSummaryLike = RecipeMediaLike & {
  name: string;
  description: string | null;
  url: string | null;
  categories: RecipeCategory[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  tags: RecipeTagLike[];
  author?: { id?: string; name?: string | null; image?: string | null } | null;
};

type ReadonlyRecipeSummaryProps = {
  recipe: RecipeSummaryLike;
  actions?: React.ReactNode;
  allergies?: string[];
  allergySet?: Set<string>;
  timeVariant?: "desktop" | "mobile";
};

type ReadonlyRecipeMediaProps = {
  recipe: RecipeMediaLike & {
    author?: { id?: string; name?: string | null; image?: string | null } | null;
  };
  aspectRatio?: "video" | "square" | "4/3";
  className?: string;
  rounded?: boolean;
  topLeftContent?: React.ReactNode;
  topRightContent?: React.ReactNode;
  bottomRightContent?: React.ReactNode;
};

const categoryIcons: Record<RecipeCategory, typeof FireIcon> = {
  Breakfast: FireIcon,
  Lunch: SunIcon,
  Dinner: MoonIcon,
  Snack: CakeIcon,
};

export function ReadonlyRecipeMedia({
  recipe,
  aspectRatio = "video",
  className = "",
  rounded = false,
  topLeftContent,
  topRightContent,
  bottomRightContent,
}: ReadonlyRecipeMediaProps) {
  const mediaItems = buildMediaItems(recipe);

  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] shadow-md ${className}`}>
      <MediaCarousel
        aspectRatio={aspectRatio}
        className="h-full min-h-[400px] w-full"
        items={mediaItems}
        rounded={rounded}
      />

      {topLeftContent && <div className="absolute top-4 left-4 z-50">{topLeftContent}</div>}
      {topRightContent && <div className="absolute top-4 right-4 z-50">{topRightContent}</div>}
      {bottomRightContent && (
        <div className="absolute right-4 bottom-8 z-50">{bottomRightContent}</div>
      )}

      {!topLeftContent && recipe.author && (
        <div className="absolute top-4 left-4 z-50">
          <AuthorChip
            image={recipe.author.image}
            name={recipe.author.name}
            userId={recipe.author.id}
          />
        </div>
      )}
    </div>
  );
}

export function ReadonlyRecipeSummary({
  recipe,
  actions,
  allergies = [],
  allergySet = new Set<string>(),
  timeVariant = "desktop",
}: ReadonlyRecipeSummaryProps) {
  const t = useTranslations("recipes.detail");
  const tForm = useTranslations("recipes.form");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl leading-tight font-bold">
            {recipe.name}
            {recipe.url && (
              <a
                className="ml-2 inline-block align-middle"
                href={recipe.url}
                rel="noopener noreferrer"
                target="_blank"
                title={t("viewOriginal")}
              >
                <ArrowTopRightOnSquareIcon className="text-default-400 hover:text-primary inline h-4 w-4" />
              </a>
            )}
          </h1>
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {recipe.description && (
        <div className="text-base leading-relaxed">
          <SmartMarkdownRenderer text={recipe.description} />
        </div>
      )}

      {recipe.categories.length > 0 && (
        <div className="text-default-500 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
          {recipe.categories.map((category) => {
            const IconComponent = categoryIcons[category] ?? SunIcon;

            return (
              <span key={category} className="flex items-center gap-1">
                <IconComponent className="h-4 w-4" />
                {tForm(`category.${category.toLowerCase()}`)}
              </span>
            );
          })}
        </div>
      )}

      {(recipe.prepMinutes || recipe.cookMinutes || recipe.totalMinutes) && (
        <div className="text-default-500 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
          {recipe.prepMinutes && recipe.prepMinutes > 0 && (
            <span className="flex items-center gap-1">
              <WrenchScrewdriverIcon className="h-4 w-4" />
              {formatMinutesHM(recipe.prepMinutes)}
              {timeVariant === "mobile" ? ` ${t("prep")}` : ""}
            </span>
          )}
          {recipe.cookMinutes && recipe.cookMinutes > 0 && (
            <span className="flex items-center gap-1">
              <FireIcon className="h-4 w-4" />
              {formatMinutesHM(recipe.cookMinutes)}
              {timeVariant === "mobile" ? ` ${t("cook")}` : ""}
            </span>
          )}
          {recipe.totalMinutes && recipe.totalMinutes > 0 && (
            <span className="flex items-center gap-1">
              <ClockIcon className="h-4 w-4" />
              {formatMinutesHM(recipe.totalMinutes)}
              {timeVariant === "mobile" ? ` ${t("total")}` : ""}
            </span>
          )}
        </div>
      )}

      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortTagsWithAllergyPriority(recipe.tags, allergies).map((tag) => {
            const isAllergen = isAllergenTag(tag.name, allergySet);

            return (
              <Chip
                key={tag.name}
                className={isAllergen ? "bg-warning text-warning-foreground" : ""}
                size="sm"
                variant="flat"
              >
                {tag.name}
              </Chip>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ReadonlyRecipeNotes({ notes }: { notes: string | null }) {
  if (!notes) {
    return null;
  }

  return <SmartMarkdownRenderer text={notes} />;
}
