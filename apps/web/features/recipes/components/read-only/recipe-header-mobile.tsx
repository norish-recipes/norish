"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import OriginFlag from "@/components/recipes/origin-flag";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useCategoryLabel } from "@/lib/category-display";
import { ClockIcon, FireIcon, TagIcon, UserGroupIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeCategory } from "@norish/shared/contracts";
import {
  formatMinutesHM,
  isAllergenTag,
  NO_ALLERGIES,
  sortTagsWithAllergyPriority,
} from "@norish/shared/lib/helpers";

type RecipeTagLike = { name: string };

export type RecipeHeaderRecipeLike = {
  name: string;
  description: string | null;
  categories: RecipeCategory[];
  tags: RecipeTagLike[];
  totalMinutes: number | null;
  servings?: number | null;
  calories?: number | null;
  /** Alpha-2, so the flag and its label are resolved at render time. */
  originCountry?: string | null;
};

type RecipeHeaderMobileProps = {
  recipe: RecipeHeaderRecipeLike;
  allergies?: string[];
  allergySet?: ReadonlySet<string>;
  /**
   * Calories are Nutrition Information, which is a Hidden Item — a reader who
   * has hidden it loses the entry here too, because a bar that restates a
   * hidden fact is exactly the bug a restating bar invites.
   */
  showCalories?: boolean;
};

type GlanceEntry = {
  key: string;
  icon: typeof ClockIcon;
  value: string;
  label: string;
};

/**
 * The Glance Bar: total time, servings and calories, so the whole answer to
 * "can I cook this tonight?" arrives before any scrolling. It restates facts
 * the sections below own and holds none of its own, so an entry the recipe
 * does not store is simply absent and a recipe storing none of the three
 * renders no bar at all.
 *
 * One filled bar floating on the page background, not an outlined box: the
 * cards below already carry the page's edges, and a second kind of edge
 * around three numbers reads as a form field. Each entry is its icon and its
 * value on one line — the icon does the naming the library's own cards let
 * it do — with the written label kept for anyone reading by ear.
 */
function GlanceBar({ entries }: { entries: GlanceEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <dl
      className="bg-surface flex items-center rounded-2xl px-2 py-3 shadow-sm"
      data-testid="glance-bar"
    >
      {entries.map((entry, index) => (
        <Fragment key={entry.key}>
          {index > 0 && <span aria-hidden className="bg-border h-4 w-px shrink-0" />}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2">
            <entry.icon aria-hidden className="text-muted size-4 shrink-0" />
            <dt className="sr-only">{entry.label}</dt>
            <dd className="text-foreground truncate text-sm font-semibold tabular-nums">
              {entry.value}
            </dd>
          </div>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * What the recipe is filed under, as one quiet line rather than a paragraph of
 * chips: a dozen chips below the title compete with the title for the eye, and
 * none of them is what the reader came for.
 *
 * Allergen tags are the exception and keep their fill and their place at the
 * front, because a warning that reads like the rest of the list is not a
 * warning. Categories join the same line — they are another way the recipe is
 * filed, and the library and the calendar are where filing earns its space.
 */
function TagLine({
  categories,
  tags,
  allergies,
  allergySet,
}: {
  categories: RecipeCategory[];
  tags: RecipeTagLike[];
  allergies: string[];
  allergySet: ReadonlySet<string>;
}) {
  const tForm = useTranslations("recipes.form");
  const categoryLabel = useCategoryLabel();

  const sorted = sortTagsWithAllergyPriority(tags, allergies);
  const allergens = sorted.filter((tag) => isAllergenTag(tag.name, allergySet));
  const plain = [
    ...categories.map(categoryLabel),
    ...sorted.filter((tag) => !isAllergenTag(tag.name, allergySet)).map((tag) => tag.name),
  ];

  if (allergens.length === 0 && plain.length === 0) return null;

  // Inline flow rather than a flex row: the icon leads the sentence and wraps
  // with it, instead of being stranded on a line of its own once the list is
  // longer than the screen.
  return (
    <p className="text-muted text-center text-xs leading-relaxed">
      <TagIcon aria-hidden className="mr-1.5 inline size-3.5 -translate-y-px" />
      <span className="sr-only">{tForm("tags")}</span>

      {allergens.map((tag) => (
        <span
          key={tag.name}
          className="bg-warning text-warning-foreground mr-1.5 rounded-full px-2 py-0.5 font-medium"
        >
          {tag.name}
        </span>
      ))}

      {plain.join(", ")}
    </p>
  );
}

/**
 * Lines a description gets before it is standing between the reader and the
 * recipe. Written out rather than interpolated, because Tailwind reads class
 * names from the source and never sees a name a template literal builds.
 */
const DESCRIPTION_CLAMP_CLASS = "line-clamp-4";

/**
 * The description, clamped. A long import can run to a dozen centred lines and
 * push the ingredients off the screen entirely, so it gets four and a way to
 * ask for the rest. A description that already fits is drawn plain, with no
 * control offered for something there is nothing more of.
 */
function RecipeDescription({ text }: { text: string }) {
  const t = useTranslations("recipes.detail");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);

  const measure = useCallback(() => {
    const body = bodyRef.current;

    if (!body) return;

    // Measured while clamped, so expanding cannot make the answer flip back.
    setIsClamped((wasClamped) => (isExpanded ? wasClamped : body.scrollHeight > body.clientHeight));
  }, [isExpanded]);

  useEffect(() => {
    measure();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    const body = bodyRef.current;

    if (body) observer.observe(body);

    return () => observer.disconnect();
  }, [measure, text]);

  return (
    <div className="space-y-1">
      <div
        ref={bodyRef}
        className={`text-muted text-base leading-relaxed text-balance ${
          isExpanded ? "" : DESCRIPTION_CLAMP_CLASS
        }`}
      >
        <SmartMarkdownRenderer text={text} />
      </div>

      {(isClamped || isExpanded) && (
        <Button
          className="text-muted h-auto min-h-0 px-2 py-1 text-xs font-medium"
          size="sm"
          variant="tertiary"
          onPress={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded ? t("showLess") : t("showMore")}
        </Button>
      )}
    </div>
  );
}

/**
 * The phone's recipe header, centred under the photo it fades out of rather
 * than inside a card: what the dish is, what it is like, and the Glance Bar,
 * before the first section starts. Shared by the recipe page and the share
 * page so a shared link looks like Norish; the desktop pages keep
 * `ReadonlyRecipeSummary` untouched.
 *
 * Who added the recipe is not here — it sits with where the recipe came from,
 * in the Source card, which is the same question asked twice.
 */
export default function RecipeHeaderMobile({
  recipe,
  allergies = [],
  allergySet = NO_ALLERGIES,
  showCalories = true,
}: RecipeHeaderMobileProps) {
  const t = useTranslations("recipes.glanceBar");
  const tNutrition = useTranslations("recipes.nutrition");

  const entries: GlanceEntry[] = [];
  const totalTime = recipe.totalMinutes ? formatMinutesHM(recipe.totalMinutes) : undefined;

  if (totalTime) {
    entries.push({
      key: "total-time",
      icon: ClockIcon,
      value: totalTime,
      label: t("totalTime"),
    });
  }

  if (recipe.servings) {
    entries.push({
      key: "servings",
      icon: UserGroupIcon,
      value: String(recipe.servings),
      label: t("servings", { count: recipe.servings }),
    });
  }

  if (showCalories && recipe.calories != null) {
    entries.push({
      key: "calories",
      icon: FireIcon,
      value: String(Math.round(recipe.calories)),
      label: tNutrition("calories"),
    });
  }

  return (
    <header className="space-y-4 text-center">
      <h1 className="text-3xl leading-tight font-bold text-balance">
        <OriginFlag className="mr-2" originCountry={recipe.originCountry} />
        {recipe.name}
      </h1>

      {recipe.description && <RecipeDescription text={recipe.description} />}

      <GlanceBar entries={entries} />

      <TagLine
        allergies={allergies}
        allergySet={allergySet}
        categories={recipe.categories}
        tags={recipe.tags}
      />
    </header>
  );
}
