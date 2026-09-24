"use client";

import { useCallback, useState } from "react";
import AuthorChip from "@/components/recipes/author-chip";
import OriginFlag from "@/components/recipes/origin-flag";
import { RECIPE_HERO_CHROME_BUTTON_CLASS } from "@/components/recipes/recipe-layout-constants";
import MediaCarousel, { buildMediaItems } from "@/components/shared/media-carousel";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import {
  ArrowsPointingOutIcon,
  ArrowTopRightOnSquareIcon,
  CakeIcon,
  ClockIcon,
  FireIcon,
  MoonIcon,
  SunIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/16/solid";
import { Button, Chip, Link } from "@heroui/react";
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
  /** Alpha-2, so the flag and its label are resolved at render time. */
  originCountry?: string | null;
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
  mediaClassName?: string;
  rounded?: boolean;
  /**
   * The author chip drawn on the photo when nothing else claims the top-left
   * slot. Off where the header underneath already names the author.
   */
  showAuthorFallback?: boolean;
  /**
   * Carried by every control floating on the photo, so a page that has to
   * clear a status bar moves the whole row by one amount rather than each
   * caller offsetting its own button.
   */
  chromeClassName?: string;
  /**
   * Which floating chrome row gets an expand control while the visible media
   * is a video, or nothing at all when the page wants none. Only the phone
   * heroes ask: they cover the player's own controls with the fade the photo
   * dissolves into and with the title pulled up over it, while a desktop page
   * shows that same bar on hover and needs nothing added (#563).
   */
  expandControlSlot?: "topLeft" | "topRight";
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

/**
 * The recipe photo, and whatever the page floats on top of it.
 *
 * Under `expandControlSlot`, a video also gets one control the player cannot
 * draw for itself. The player puts its own expand button at its bottom edge,
 * and the phone hero covers exactly that band with the fade the photo
 * dissolves into and with the title pulled up over it, so on a phone the
 * control was invisible and a video could only be watched cropped and silent
 * (#563). It is drawn in the named chrome row instead — beside the way back
 * out of the page — the one part of the hero nothing covers. It wears that
 * row's own look and expands the video the browser's own way; the element
 * never changes, so the playback position carries in and back out again.
 */
export function ReadonlyRecipeMedia({
  recipe,
  aspectRatio = "video",
  className = "",
  mediaClassName = "",
  rounded = false,
  showAuthorFallback = true,
  chromeClassName = "",
  expandControlSlot,
  topLeftContent,
  topRightContent,
  bottomRightContent,
}: ReadonlyRecipeMediaProps) {
  const t = useTranslations("recipes.carousel.videoPlayer");
  const mediaItems = buildMediaItems(recipe);
  const [enterVideoFullscreen, setEnterVideoFullscreen] = useState<(() => void) | null>(null);

  // Stored as a value, so the setter has to be told this function is the new
  // state rather than a way of computing it.
  const handleActiveVideoFullscreenChange = useCallback((enter: (() => void) | null) => {
    setEnterVideoFullscreen(() => enter);
  }, []);

  const expandVideoButton =
    expandControlSlot && enterVideoFullscreen ? (
      <Button
        isIconOnly
        aria-label={t("fullscreen")}
        className={RECIPE_HERO_CHROME_BUTTON_CLASS}
        data-testid="recipe-media-expand"
        size="sm"
        variant="tertiary"
        onPress={() => enterVideoFullscreen()}
      >
        <ArrowsPointingOutIcon />
      </Button>
    ) : null;
  // The author chip claims the same corner when the page leaves it empty, so
  // the left slot is one row rather than two blocks pinned on top of each
  // other.
  const leadingContent =
    topLeftContent ??
    (showAuthorFallback && recipe.author ? (
      <AuthorChip image={recipe.author.image} name={recipe.author.name} userId={recipe.author.id} />
    ) : null);
  const leftExpandControl = expandControlSlot === "topLeft" ? expandVideoButton : null;
  const rightExpandControl = expandControlSlot === "topRight" ? expandVideoButton : null;
  const topLeftRow =
    leadingContent || leftExpandControl ? (
      <div className={`absolute top-4 left-4 z-50 flex items-center gap-2 ${chromeClassName}`}>
        {leadingContent}
        {leftExpandControl}
      </div>
    ) : null;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <MediaCarousel
        aspectRatio={aspectRatio}
        className={`h-full w-full ${mediaClassName}`}
        items={mediaItems}
        rounded={rounded}
        onActiveVideoFullscreenChange={
          expandControlSlot ? handleActiveVideoFullscreenChange : undefined
        }
      />

      {topLeftRow}
      {(topRightContent || rightExpandControl) && (
        <div className={`absolute top-4 right-4 z-50 flex items-center gap-2 ${chromeClassName}`}>
          {topRightContent}
          {rightExpandControl}
        </div>
      )}
      {bottomRightContent && (
        <div className="absolute right-4 bottom-8 z-50">{bottomRightContent}</div>
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
            <OriginFlag className="mr-2" originCountry={recipe.originCountry} />
            {recipe.name}
            {recipe.url && (
              <Link
                className="ml-2 inline-block align-middle"
                href={recipe.url}
                rel="noopener noreferrer"
                target="_blank"
                title={t("viewOriginal")}
              >
                <ArrowTopRightOnSquareIcon className="text-muted hover:text-accent inline h-4 w-4" />
              </Link>
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
        <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
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
        <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
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
                variant="tertiary"
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
