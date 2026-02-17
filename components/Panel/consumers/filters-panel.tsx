"use client";

import type { FilterMode, RecipeCategory, SortOrder } from "@/types";

import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckIcon,
  HeartIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/16/solid";
import { Button, Chip, Input } from "@heroui/react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import Panel from "@/components/Panel/Panel";
import SearchFieldToggles from "@/components/dashboard/search-field-toggles";
import ChipSkeleton from "@/components/skeleton/chip-skeleton";
import RatingStars from "@/components/shared/rating-stars";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useTagsQuery } from "@/hooks/config";

const ALL_CATEGORIES: RecipeCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const COOKING_TIME_OPTIONS: Array<{ value: number; labelKey: string }> = [
  { value: 15, labelKey: "cookingTimeUnder15" },
  { value: 30, labelKey: "cookingTimeUnder30" },
  { value: 60, labelKey: "cookingTimeUnder60" },
  { value: 120, labelKey: "cookingTimeUnder120" },
];

function normalizeSortMode(sortMode: SortOrder | null | undefined): SortOrder {
  if (
    sortMode === "titleAsc" ||
    sortMode === "titleDesc" ||
    sortMode === "dateAsc" ||
    sortMode === "dateDesc" ||
    sortMode === "none"
  ) {
    return sortMode;
  }

  return "none";
}

type FiltersPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function FiltersPanelContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { filters, setFilters, clearFilters } = useRecipesFiltersContext();
  const t = useTranslations("common.filters");
  const tActions = useTranslations("common.actions");
  const tRecipes = useTranslations("recipes.dashboard");

  const [tagFilter, setTagFilter] = useState("");
  const [workingTags, setWorkingTags] = useState<string[]>(filters.searchTags);
  const [workingCategories, setWorkingCategories] = useState<RecipeCategory[]>(filters.categories);
  const [localFilterMode, setLocalFilterMode] = useState<FilterMode>(filters.filterMode);
  const [localSortMode, setLocalSortMode] = useState<SortOrder>(
    normalizeSortMode(filters.sortMode)
  );
  const [localInput, setLocalInput] = useState(filters.rawInput);
  const [localFavoritesOnly, setLocalFavoritesOnly] = useState(filters.showFavoritesOnly);
  const [localMinRating, setLocalMinRating] = useState<number | null>(filters.minRating);
  const [localMaxCookingTime, setLocalMaxCookingTime] = useState<number | null>(
    filters.maxCookingTime ?? null
  );

  const { tags: allTags, isLoading } = useTagsQuery();

  useEffect(() => {
    setWorkingTags(filters.searchTags);
    setWorkingCategories(filters.categories);
    setLocalFilterMode(filters.filterMode);
    setLocalSortMode(normalizeSortMode(filters.sortMode));
    setLocalInput(filters.rawInput);
    setLocalFavoritesOnly(filters.showFavoritesOnly);
    setLocalMinRating(filters.minRating);
    setLocalMaxCookingTime(filters.maxCookingTime ?? null);
  }, [filters]);

  const toggleTag = useCallback((tag: string) => {
    setWorkingTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const toggleCategory = useCallback((category: RecipeCategory) => {
    setWorkingCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const toggleCookingTime = useCallback((value: number) => {
    setLocalMaxCookingTime((prev) => (prev === value ? null : value));
  }, []);

  const decideSortOrder = (type: "title" | "date") => {
    const asc = `${type}Asc` as SortOrder;
    const desc = `${type}Desc` as SortOrder;

    if (localSortMode === asc) {
      setLocalSortMode(desc);

      return;
    }
    if (localSortMode === desc) {
      setLocalSortMode("none");

      return;
    }

    setLocalSortMode(asc);
  };

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleReset = useCallback(() => {
    clearFilters();
    setWorkingTags([]);
    setWorkingCategories([]);
    setLocalFilterMode("AND");
    setLocalSortMode("dateDesc");
    setLocalInput("");
    setLocalFavoritesOnly(false);
    setLocalMinRating(null);
    setLocalMaxCookingTime(null);
    close();
  }, [clearFilters, close]);

  const apply = useCallback(() => {
    setFilters({
      searchTags: [...workingTags],
      categories: [...workingCategories],
      filterMode: localFilterMode,
      sortMode: localSortMode,
      rawInput: localInput,
      showFavoritesOnly: localFavoritesOnly,
      minRating: localMinRating,
      maxCookingTime: localMaxCookingTime,
    });

    close();
  }, [
    setFilters,
    workingTags,
    workingCategories,
    localFilterMode,
    localSortMode,
    localInput,
    localFavoritesOnly,
    localMinRating,
    localMaxCookingTime,
    close,
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("search")}
        </h3>
        <Input
          isClearable
          placeholder={tRecipes("searchRecipesPlaceholder")}
          radius="full"
          startContent={<MagnifyingGlassIcon className="text-default-400 h-4 w-4" />}
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onClear={() => setLocalInput("")}
        />
        <SearchFieldToggles className="mt-2" itemClassName="h-9 px-3 text-xs" />
      </section>

      {/* Sort */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("sort")}
        </h3>
        <div className="flex gap-2">
          {[
            { key: "title", label: t("sortByTitle") },
            { key: "date", label: t("sortByDate") },
          ].map(({ key, label }) => {
            const isActive = localSortMode.startsWith(key) && localSortMode !== "none";
            const isAsc = localSortMode === `${key}Asc`;

            return (
              <Button
                key={key}
                className="h-9 px-3 text-xs"
                color={isActive ? "primary" : "default"}
                radius="full"
                size="sm"
                startContent={
                  <motion.span
                    animate={{
                      rotate: !isActive ? 0 : isAsc ? -90 : 90,
                    }}
                    className="inline-flex origin-center"
                    initial={false}
                    transition={{ type: "spring", stiffness: 340, damping: 26 }}
                  >
                    <ArrowRightIcon className="size-3.5" />
                  </motion.span>
                }
                variant={isActive ? "solid" : "flat"}
                onPress={() => decideSortOrder(key as "title" | "date")}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Mode */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("mode")}
        </h3>
        <div className="flex gap-2">
          {[
            { label: t("modeAll"), value: "AND" },
            { label: t("modeAny"), value: "OR" },
          ].map(({ label, value }) => (
            <Button
              key={value}
              className="h-9 px-3 text-xs"
              color={localFilterMode === value ? "primary" : "default"}
              radius="full"
              size="sm"
              startContent={<CheckIcon className="size-3.5" />}
              variant={localFilterMode === value ? "solid" : "flat"}
              onPress={() => setLocalFilterMode(value as FilterMode)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      {/* Favorites & Rating */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("favoritesAndRating")}
        </h3>
        <div className="flex items-center gap-4">
          <Button
            className="h-9 px-3 text-xs"
            color={localFavoritesOnly ? "danger" : "default"}
            radius="full"
            size="sm"
            startContent={<HeartIcon className="size-3.5" />}
            variant={localFavoritesOnly ? "solid" : "flat"}
            onPress={() => setLocalFavoritesOnly(!localFavoritesOnly)}
          >
            {t("favorites")}
          </Button>

          <RatingStars value={localMinRating} onChange={setLocalMinRating} />
        </div>
      </section>

      {/* Cooking time */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("cookingTime")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {COOKING_TIME_OPTIONS.map(({ value, labelKey }) => {
            const active = localMaxCookingTime === value;

            return (
              <Button
                key={value}
                className="h-9 px-3 text-xs"
                color={active ? "primary" : "default"}
                radius="full"
                size="sm"
                variant={active ? "solid" : "flat"}
                onPress={() => toggleCookingTime(value)}
              >
                {t(labelKey)}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Categories */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("categories")}
        </h3>
        <div className="flex flex-wrap gap-1">
          {ALL_CATEGORIES.map((category) => {
            const active = workingCategories.includes(category);

            return (
              <Chip
                key={category}
                className="h-7 cursor-pointer px-2 text-[11px]"
                color={active ? "primary" : "default"}
                radius="full"
                variant={active ? "solid" : "flat"}
                onClick={() => toggleCategory(category)}
              >
                {t(`category.${category.toLowerCase()}`)}
              </Chip>
            );
          })}
        </div>
      </section>

      {/* Tags */}
      <section>
        <h3 className="text-default-500 mb-3 text-xs font-medium tracking-wide uppercase">
          {t("tags")}
        </h3>

        <div className="relative mb-3">
          <Input
            isClearable
            classNames={{
              inputWrapper: "h-9",
              input: "text-sm",
            }}
            placeholder={t("searchTags")}
            radius="full"
            startContent={<MagnifyingGlassIcon className="text-default-400 h-4 w-4" />}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            onClear={() => setTagFilter("")}
          />
        </div>

        {isLoading ? (
          <ChipSkeleton />
        ) : (
          <div className="flex max-h-[220px] flex-wrap gap-1 overflow-y-auto pr-1">
            {allTags
              .filter((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))
              .map((tag) => {
                const active = workingTags.includes(tag);

                return (
                  <Chip
                    key={tag}
                    className="h-7 cursor-pointer px-2 text-[11px]"
                    color={active ? "primary" : "default"}
                    radius="full"
                    variant={active ? "solid" : "flat"}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Chip>
                );
              })}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="border-default-200/50 mt-auto flex justify-end gap-3 border-t pt-3">
        <Button
          color="danger"
          radius="full"
          size="sm"
          startContent={<ArrowPathIcon className="size-4" />}
          variant="flat"
          onPress={handleReset}
        >
          {tActions("reset")}
        </Button>
        <Button
          color="primary"
          radius="full"
          size="sm"
          startContent={<CheckIcon className="size-4" />}
          onPress={apply}
        >
          {tActions("apply")}
        </Button>
      </div>
    </div>
  );
}

export default function FiltersPanel({ open, onOpenChange }: FiltersPanelProps) {
  const t = useTranslations("common.filters");

  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      {open && <FiltersPanelContent onOpenChange={onOpenChange} />}
    </Panel>
  );
}
