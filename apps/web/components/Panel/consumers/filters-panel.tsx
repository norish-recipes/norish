"use client";

import { useCallback, useEffect, useState } from "react";
import SearchFieldToggles from "@/components/dashboard/search-field-toggles";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import ChipSkeleton from "@/components/skeleton/chip-skeleton";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useUserContext } from "@/context/user-context";
import { useTagsQuery } from "@/hooks/config";
import {
  ArrowRightIcon,
  CheckIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { Button, Chip, Input } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { FilterMode, RecipeCategory, SortOrder } from "@norish/shared/contracts";
import {
  getShowFavoritesPreference,
  getShowRatingsPreference,
} from "@norish/shared/lib/user-preferences";
import StarRating from "@norish/ui/star-rating";

const ALL_CATEGORIES: RecipeCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const COOKING_TIME_OPTIONS: Array<{
  value: number;
  labelKey: string;
}> = [
  {
    value: 15,
    labelKey: "cookingTimeUnder15",
  },
  {
    value: 30,
    labelKey: "cookingTimeUnder30",
  },
  {
    value: 60,
    labelKey: "cookingTimeUnder60",
  },
  {
    value: 120,
    labelKey: "cookingTimeUnder120",
  },
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

function FilterSearchInput({
  placeholder,
  value,
  onChange,
  compact = false,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon className="text-muted pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2" />
      <Input
        fullWidth
        className={compact ? "h-9 text-sm" : undefined}
        placeholder={placeholder}
        style={{
          paddingLeft: "2.25rem",
          paddingRight: value.length > 0 ? "2.25rem" : "0.875rem",
        }}
        value={value}
        variant="secondary"
        onChange={(e) => onChange(e.target.value)}
      />
      {value.length > 0 && (
        <button
          aria-label="Clear"
          className="text-muted hover:bg-surface-secondary hover:text-foreground absolute top-1/2 right-1.5 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
          type="button"
          onClick={() => onChange("")}
          onMouseDown={(e) => e.preventDefault()}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
type FiltersPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
export default function FiltersPanel({ open, onOpenChange }: FiltersPanelProps) {
  const { filters, setFilters, clearFilters } = useRecipesFiltersContext();
  const { user } = useUserContext();
  const t = useTranslations("common.filters");
  const tActions = useTranslations("common.actions");
  const tRecipes = useTranslations("recipes.dashboard");
  const showRatings = getShowRatingsPreference(user);
  const showFavorites = getShowFavoritesPreference(user);
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
      showFavoritesOnly: showFavorites ? localFavoritesOnly : false,
      minRating: showRatings ? localMinRating : null,
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
    showFavorites,
    showRatings,
    close,
  ]);
  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      {open ? (
        <Panel.Body className="gap-6">
          {/* Search */}
          <section>
            <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
              {t("search")}
            </h3>
            <FilterSearchInput
              placeholder={tRecipes("searchRecipesPlaceholder")}
              value={localInput}
              onChange={setLocalInput}
            />
            <SearchFieldToggles className="mt-2" itemClassName="h-9 px-3 text-xs" />
          </section>

          {/* Sort */}
          <section>
            <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
              {t("sort")}
            </h3>
            <div className="flex gap-2">
              {[
                {
                  key: "title",
                  label: t("sortByTitle"),
                },
                {
                  key: "date",
                  label: t("sortByDate"),
                },
              ].map(({ key, label }) => {
                const isActive = localSortMode.startsWith(key) && localSortMode !== "none";
                const isAsc = localSortMode === `${key}Asc`;
                return (
                  <Button
                    key={key}
                    className="h-9 min-w-16 rounded-full px-3 text-xs"
                    size="sm"
                    variant={isActive ? "primary" : "tertiary"}
                    onPress={() => decideSortOrder(key as "title" | "date")}
                  >
                    {
                      <motion.span
                        animate={{
                          rotate: !isActive ? 0 : isAsc ? -90 : 90,
                        }}
                        className="inline-flex origin-center"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 340,
                          damping: 26,
                        }}
                      >
                        <ArrowRightIcon className="size-3.5" />
                      </motion.span>
                    }
                    {label}
                  </Button>
                );
              })}
            </div>
          </section>

          {/* Mode */}
          <section>
            <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
              {t("mode")}
            </h3>
            <div className="flex gap-2">
              {[
                {
                  label: t("modeAll"),
                  value: "AND",
                },
                {
                  label: t("modeAny"),
                  value: "OR",
                },
              ].map(({ label, value }) => {
                const active = localFilterMode === value;
                return (
                  <Button
                    key={value}
                    className="h-9 min-w-16 rounded-full px-3 text-xs"
                    size="sm"
                    variant={active ? "primary" : "tertiary"}
                    onPress={() => setLocalFilterMode(value as FilterMode)}
                  >
                    {<CheckIcon className="size-3.5" />}
                    {label}
                  </Button>
                );
              })}
            </div>
          </section>

          {/* Favorites & Rating */}
          {(showFavorites || showRatings) && (
            <section>
              <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
                {t("favoritesAndRating")}
              </h3>
              <div className="flex items-center gap-4">
                {showFavorites && (
                  <Button
                    className="h-9 min-w-16 rounded-full px-3 text-xs"
                    size="sm"
                    variant={localFavoritesOnly ? "primary" : "tertiary"}
                    onPress={() => setLocalFavoritesOnly(!localFavoritesOnly)}
                  >
                    {<HeartIcon className="size-3.5" />}
                    {t("favorites")}
                  </Button>
                )}

                {showRatings && (
                  <StarRating
                    allowClear
                    showValueSuffix
                    size="sm"
                    value={localMinRating}
                    onChange={setLocalMinRating}
                  />
                )}
              </div>
            </section>
          )}

          {/* Cooking time */}
          <section>
            <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
              {t("cookingTime")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {COOKING_TIME_OPTIONS.map(({ value, labelKey }) => {
                const active = localMaxCookingTime === value;
                return (
                  <Button
                    key={value}
                    className="h-9 min-w-16 rounded-full px-3 text-xs"
                    size="sm"
                    variant={active ? "primary" : "tertiary"}
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
            <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
              {t("categories")}
            </h3>
            <div className="flex flex-wrap gap-1">
              {ALL_CATEGORIES.map((category) => {
                const active = workingCategories.includes(category);
                return (
                  <Chip
                    key={category}
                    className="h-7 cursor-pointer px-2 text-[11px]"
                    color={active ? "accent" : "default"}
                    variant={active ? "primary" : "tertiary"}
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
            <h3 className="text-muted mb-3 text-xs font-medium tracking-wide uppercase">
              {t("tags")}
            </h3>

            <div className="relative mb-3">
              <FilterSearchInput
                compact
                placeholder={t("searchTags")}
                value={tagFilter}
                onChange={setTagFilter}
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
                        color={active ? "accent" : "default"}
                        variant={active ? "primary" : "tertiary"}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Chip>
                    );
                  })}
              </div>
            )}
          </section>
        </Panel.Body>
      ) : null}

      {open ? (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="reset" onPress={handleReset}>
              {tActions("reset")}
            </ActionButton>
            <ActionButton action="apply" onPress={apply}>
              {tActions("apply")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}
