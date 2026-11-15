"use client";

import { useState } from "react";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ChipButton } from "@/components/shared/chip-button";
import { ChipSkeleton } from "@/features/library/components/skeleton";
import { useCategoryLabel } from "@/lib/category-display";
import {
  ArchiveBoxIcon,
  ArrowRightIcon,
  CheckIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { Button, Input } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { FilterMode } from "@norish/shared/contracts";
import { useCategoriesQuery, useTagsQuery } from "@norish/shared-react/config";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { COOKING_TIME_OPTIONS, useFiltersDraft } from "@norish/shared-react/recipes";
import StarRating from "@norish/ui/star-rating";

import SearchFieldToggles from "./search-field-toggles";

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
  const t = useTranslations("common.filters");

  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      <FiltersContent onOpenChange={onOpenChange} />
    </Panel>
  );
}

/** The panel's content, mounted while it is open: each opening starts from the applied filters. */
function FiltersContent({ onOpenChange }: Omit<FiltersPanelProps, "open">) {
  const t = useTranslations("common.filters");
  const tActions = useTranslations("common.actions");
  const tRecipes = useTranslations("recipes.dashboard");
  const { showRatings, showFavorites } = useHiddenItemVisibility();
  const [tagFilter, setTagFilter] = useState("");
  const {
    draft,
    update,
    toggleTag,
    toggleCategory,
    toggleCookingTime,
    decideSortOrder,
    reset,
    apply,
  } = useFiltersDraft();
  const { categories: householdCategories } = useCategoriesQuery();
  const categoryLabel = useCategoryLabel();
  // A stored filter stays visible, so it can be cleared, even once the list drops it.
  const categoryOptions = Array.from(new Set([...householdCategories, ...draft.categories]));
  const { tags: allTags, isLoading } = useTagsQuery();
  const close = () => onOpenChange(false);
  const handleReset = () => {
    reset();
    close();
  };
  const handleApply = () => {
    apply();
    close();
  };

  return (
    <>
      <Panel.Body className="gap-6">
        {/* Search */}
        <section>
          <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("search")}
          </h3>
          <FilterSearchInput
            placeholder={tRecipes("searchRecipesPlaceholder")}
            value={draft.rawInput}
            onChange={(rawInput) => update({ rawInput })}
          />
        </section>

        {/* Search in — which fields a search looks at. It sits beside the
            other filters rather than under the page's search bar, and lands
            with this panel's Apply like everything else here. */}
        <section>
          <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("searchIn")}
          </h3>
          <SearchFieldToggles
            itemClassName="h-9 px-3 text-xs"
            value={draft.searchFields}
            onChange={(searchFields) => update({ searchFields })}
          />
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
              const isActive = draft.sortMode.startsWith(key) && draft.sortMode !== "none";
              const isAsc = draft.sortMode === `${key}Asc`;

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
              const active = draft.filterMode === value;

              return (
                <Button
                  key={value}
                  className="h-9 min-w-16 rounded-full px-3 text-xs"
                  size="sm"
                  variant={active ? "primary" : "tertiary"}
                  onPress={() => update({ filterMode: value as FilterMode })}
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
                  variant={draft.showFavoritesOnly ? "primary" : "tertiary"}
                  onPress={() => update({ showFavoritesOnly: !draft.showFavoritesOnly })}
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
                  value={draft.minRating}
                  onChange={(minRating) => update({ minRating })}
                />
              )}
            </div>
          </section>
        )}

        {/* Pantry */}
        <section>
          <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("pantry")}
          </h3>
          <Button
            aria-pressed={draft.showPantryOnly}
            className="h-9 min-w-16 rounded-full px-3 text-xs"
            size="sm"
            variant={draft.showPantryOnly ? "primary" : "tertiary"}
            onPress={() => update({ showPantryOnly: !draft.showPantryOnly })}
          >
            <ArchiveBoxIcon className="size-3.5" />
            {t("pantryOnly")}
          </Button>
        </section>

        {/* Cooking time */}
        <section>
          <h3 className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("cookingTime")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {COOKING_TIME_OPTIONS.map(({ value, labelKey }) => {
              const active = draft.maxCookingTime === value;

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
            {categoryOptions.map((category) => {
              const active = draft.categories.includes(category);

              return (
                <ChipButton
                  key={category}
                  aria-pressed={active}
                  className="h-7 cursor-pointer px-2 text-[11px]"
                  color={active ? "accent" : "default"}
                  variant={active ? "primary" : "tertiary"}
                  onClick={() => toggleCategory(category)}
                >
                  {categoryLabel(category)}
                </ChipButton>
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
                  const active = draft.searchTags.includes(tag);

                  return (
                    <ChipButton
                      key={tag}
                      aria-pressed={active}
                      className="h-7 cursor-pointer px-2 text-[11px]"
                      color={active ? "accent" : "default"}
                      variant={active ? "primary" : "tertiary"}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </ChipButton>
                  );
                })}
            </div>
          )}
        </section>
      </Panel.Body>

      <Panel.Footer>
        <ActionButtonGroup>
          <ActionButton action="reset" onPress={handleReset}>
            {tActions("reset")}
          </ActionButton>
          <ActionButton action="apply" onPress={handleApply}>
            {tActions("apply")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </>
  );
}
