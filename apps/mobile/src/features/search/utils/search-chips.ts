import type { Ionicons } from "@/components/icon";
import type { ComponentProps } from "react";

import type { HiddenItemVisibility } from "@norish/shared-react/reader";
import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { COOKING_TIME_OPTIONS } from "@norish/shared-react/recipes";

type Patch = Partial<CanonicalRecipeFilters>;

/** A Quick filter: one tap sets `on`, shown with the Filters sheet's icon for the same filter. */
type QuickSetting = {
  labelId: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  on: Patch;
};

/** How a chip says its filter: a message by id, a category by its name, an Ingredient by its id. */
export type ChipSpeech = {
  say: (id: string, values?: Record<string, string | number>) => string;
  category: (name: string) => string;
  ingredient: (ingredientId: string) => string;
};

/** What one kind of chip knows: the values it is applied with, how it reads and how it is removed. */
type ChipKind<V> = {
  values: (filters: CanonicalRecipeFilters) => V[];
  label: (value: V, speech: ChipSpeech) => string;
  remove: (filters: CanonicalRecipeFilters, value: V) => Patch;
  /** The Ingredient whose icon the chip shows; absent for no icon. */
  icon?: (value: V) => string;
  /** Whether the reader's Hidden Items leave this filter on offer; absent for always. */
  offered?: (visibility: HiddenItemVisibility) => boolean;
  /** The Quick filter Search offers for this kind with no text; absent for none. */
  quick?: QuickSetting;
};

const kind = <V>(definition: ChipKind<V>) => definition;

/** One definition per kind, in the order the chips show; adding a filter's chip is adding its entry. */
const CHIP_KINDS = {
  category: kind<string>({
    values: (filters) => filters.categories,
    label: (value, { category }) => category(value),
    remove: (filters, value) => ({
      categories: filters.categories.filter((item) => item !== value),
    }),
  }),
  tag: kind<string>({
    values: (filters) => filters.searchTags,
    label: (value) => value,
    remove: (filters, value) => ({
      searchTags: filters.searchTags.filter((item) => item !== value),
    }),
  }),
  ingredient: kind<string>({
    values: (filters) => filters.ingredients,
    label: (value, { ingredient }) => ingredient(value),
    icon: (value) => value,
    remove: (filters, value) => ({
      ingredients: filters.ingredients.filter((item) => item !== value),
    }),
  }),
  time: kind<number>({
    values: (filters) => (filters.maxCookingTime === null ? [] : [filters.maxCookingTime]),
    label: (value, { say }) => {
      const option = COOKING_TIME_OPTIONS.find((item) => item.value === value);

      return say(option ? `common.filters.${option.labelKey}` : "common.filters.cookingTime");
    },
    remove: () => ({ maxCookingTime: null }),
    quick: {
      labelId: "recipes.search.underThirty",
      icon: "time-outline",
      on: { maxCookingTime: 30 },
    },
  }),
  rating: kind<number>({
    values: (filters) => (filters.minRating === null ? [] : [filters.minRating]),
    label: (value, { say }) => say("recipes.search.ratingChip", { count: value }),
    remove: () => ({ minRating: null }),
    offered: (visibility) => visibility.showRatings,
    quick: { labelId: "recipes.search.fourAndUp", icon: "star", on: { minRating: 4 } },
  }),
  favorites: kind<true>({
    values: (filters) => (filters.showFavoritesOnly ? [true] : []),
    label: (_value, { say }) => say("common.filters.favorites"),
    remove: () => ({ showFavoritesOnly: false }),
    offered: (visibility) => visibility.showFavorites,
    quick: {
      labelId: "common.filters.favorites",
      icon: "heart-outline",
      on: { showFavoritesOnly: true },
    },
  }),
  pantry: kind<true>({
    values: (filters) => (filters.showPantryOnly ? [true] : []),
    label: (_value, { say }) => say("common.filters.pantryOnly"),
    remove: () => ({ showPantryOnly: false }),
    quick: {
      labelId: "common.filters.pantryOnly",
      icon: "file-tray-full-outline",
      on: { showPantryOnly: true },
    },
  }),
};

type Kinds = typeof CHIP_KINDS;

/** One applied filter, as the chip that removes it names it. */
export type FilterChip = {
  [K in keyof Kinds]: { kind: K; value: ReturnType<Kinds[K]["values"]>[number] };
}[keyof Kinds];

// The kinds' functions take their own value type; a chip holds exactly that, so a lookup by its kind is sound.
const kindOf = (chip: FilterChip) => CHIP_KINDS[chip.kind] as ChipKind<FilterChip["value"]>;

/** The applied filters in the order the chips show. */
export const filterChips = (filters: CanonicalRecipeFilters) =>
  (Object.keys(CHIP_KINDS) as (keyof Kinds)[]).flatMap((name) =>
    (CHIP_KINDS[name] as ChipKind<FilterChip["value"]>)
      .values(filters)
      .map((value) => ({ kind: name, value }) as FilterChip)
  );

/** What `chip` says. */
export const chipLabel = (chip: FilterChip, speech: ChipSpeech) =>
  kindOf(chip).label(chip.value, speech);

/** The Ingredient whose icon `chip` shows, or null. */
export const chipIcon = (chip: FilterChip) => kindOf(chip).icon?.(chip.value) ?? null;

/** `filters` less `chip`, as the patch to apply. */
export const withoutChip = (filters: CanonicalRecipeFilters, chip: FilterChip): Patch =>
  kindOf(chip).remove(filters, chip.value);

/** The Quick filters in the board's order. */
const QUICK_ORDER = ["favorites", "time", "rating", "pantry"] as const;

type QuickFilter = QuickSetting & { kind: (typeof QUICK_ORDER)[number] };

/** The Quick filters the reader's Hidden Items leave on offer. */
export const quickFilters = (visibility: HiddenItemVisibility): QuickFilter[] =>
  QUICK_ORDER.flatMap((kind) => {
    const { quick, offered } = CHIP_KINDS[kind];

    return quick && offered?.(visibility) !== false ? [{ kind, ...quick }] : [];
  });

/** A key for a chip that is stable while the others come and go. */
export const chipKey = (chip: FilterChip) => `${chip.kind}:${String(chip.value)}`;
