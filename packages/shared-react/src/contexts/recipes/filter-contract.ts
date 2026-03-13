import {
  DEFAULT_SEARCH_FIELDS,
  FilterMode,
  RecipeCategory,
  SEARCH_FIELDS,
  SearchField,
  SortOrder,
} from "@norish/shared/contracts";

export type CanonicalRecipeFilters = {
  rawInput: string;
  searchTags: string[];
  searchFields: SearchField[];
  filterMode: FilterMode;
  sortMode: SortOrder;
  showFavoritesOnly: boolean;
  minRating: number | null;
  maxCookingTime: number | null;
  categories: RecipeCategory[];
};

export type PersistedRecipeFilters = Omit<CanonicalRecipeFilters, "rawInput">;

export type RecipeFilterPreset = {
  id: string;
  label: string;
  apply: (filters: CanonicalRecipeFilters) => CanonicalRecipeFilters;
  isActive: (filters: CanonicalRecipeFilters) => boolean;
};

const VALID_CATEGORIES: RecipeCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const VALID_SORT_MODES: SortOrder[] = ["titleAsc", "titleDesc", "dateAsc", "dateDesc", "none"];
const VALID_FILTER_MODES: FilterMode[] = ["AND", "OR"];

export const DEFAULT_PERSISTED_RECIPE_FILTERS: PersistedRecipeFilters = {
  searchTags: [],
  searchFields: [...DEFAULT_SEARCH_FIELDS],
  filterMode: "AND",
  sortMode: "dateDesc",
  showFavoritesOnly: false,
  minRating: null,
  maxCookingTime: null,
  categories: [],
};

export const DEFAULT_RECIPE_FILTERS: CanonicalRecipeFilters = {
  rawInput: "",
  ...DEFAULT_PERSISTED_RECIPE_FILTERS,
};

export const RECIPE_COOKING_TIME_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "< 15 min", value: 15 },
  { label: "< 30 min", value: 30 },
  { label: "< 60 min", value: 60 },
  { label: "< 2 hrs", value: 120 },
];

export const RECIPE_CATEGORY_OPTIONS: readonly RecipeCategory[] = VALID_CATEGORIES;

export function normalizePersistedRecipeFilters(data: unknown): PersistedRecipeFilters | null {
  if (typeof data !== "object" || data === null) return null;

  const d = data as Record<string, unknown>;
  const sortMode = VALID_SORT_MODES.includes(d.sortMode as SortOrder)
    ? (d.sortMode as SortOrder)
    : null;
  const filterMode = VALID_FILTER_MODES.includes(d.filterMode as FilterMode)
    ? (d.filterMode as FilterMode)
    : null;
  const searchTags = Array.isArray(d.searchTags)
    ? d.searchTags.filter((tag): tag is string => typeof tag === "string")
    : null;
  const searchFields = Array.isArray(d.searchFields)
    ? d.searchFields.filter((field): field is SearchField =>
        SEARCH_FIELDS.includes(field as SearchField)
      )
    : null;
  const showFavoritesOnly = typeof d.showFavoritesOnly === "boolean" ? d.showFavoritesOnly : null;
  const minRating =
    d.minRating === null || (typeof d.minRating === "number" && d.minRating >= 0)
      ? (d.minRating as number | null)
      : null;
  const maxCookingTime =
    d.maxCookingTime === null || (typeof d.maxCookingTime === "number" && d.maxCookingTime > 0)
      ? (d.maxCookingTime as number | null)
      : null;
  const categories = Array.isArray(d.categories)
    ? d.categories.filter((category): category is RecipeCategory =>
        VALID_CATEGORIES.includes(category as RecipeCategory)
      )
    : null;

  if (sortMode === null && filterMode === null && searchFields === null) return null;

  return {
    sortMode: sortMode ?? DEFAULT_PERSISTED_RECIPE_FILTERS.sortMode,
    filterMode: filterMode ?? DEFAULT_PERSISTED_RECIPE_FILTERS.filterMode,
    searchTags: searchTags ?? DEFAULT_PERSISTED_RECIPE_FILTERS.searchTags,
    searchFields: searchFields ?? [...DEFAULT_PERSISTED_RECIPE_FILTERS.searchFields],
    showFavoritesOnly: showFavoritesOnly ?? DEFAULT_PERSISTED_RECIPE_FILTERS.showFavoritesOnly,
    minRating: minRating ?? DEFAULT_PERSISTED_RECIPE_FILTERS.minRating,
    maxCookingTime: maxCookingTime ?? DEFAULT_PERSISTED_RECIPE_FILTERS.maxCookingTime,
    categories: categories ?? DEFAULT_PERSISTED_RECIPE_FILTERS.categories,
  };
}

export function hasAppliedRecipeFilters(filters: CanonicalRecipeFilters): boolean {
  return (
    filters.rawInput.trim().length > 0 ||
    filters.searchTags.length > 0 ||
    filters.categories.length > 0 ||
    filters.maxCookingTime !== null
  );
}

export function toRecipesQueryFilters(filters: CanonicalRecipeFilters) {
  return {
    search: filters.rawInput || undefined,
    searchFields: filters.searchFields,
    tags: filters.searchTags.length > 0 ? filters.searchTags : undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    filterMode: filters.filterMode,
    sortMode: filters.sortMode,
    minRating: filters.minRating ?? undefined,
    maxCookingTime: filters.maxCookingTime ?? undefined,
  };
}

export function serializeRecipeFilters(filters: CanonicalRecipeFilters) {
  const queryFilters = toRecipesQueryFilters(filters);

  return JSON.stringify(queryFilters);
}

export const RECIPE_FILTER_PRESETS: RecipeFilterPreset[] = [
  {
    id: "quick",
    label: "Quick (<30 min)",
    apply: (filters) => ({ ...filters, maxCookingTime: 30 }),
    isActive: (filters) => filters.maxCookingTime !== null && filters.maxCookingTime <= 30,
  },
  {
    id: "favorites",
    label: "Favorites",
    apply: (filters) => ({ ...filters, showFavoritesOnly: !filters.showFavoritesOnly }),
    isActive: (filters) => filters.showFavoritesOnly,
  },
  {
    id: "breakfast",
    label: "Breakfast",
    apply: (filters) => ({
      ...filters,
      categories: filters.categories.includes("Breakfast") ? [] : ["Breakfast"],
    }),
    isActive: (filters) => filters.categories.includes("Breakfast"),
  },
  {
    id: "lunch",
    label: "Lunch",
    apply: (filters) => ({
      ...filters,
      categories: filters.categories.includes("Lunch") ? [] : ["Lunch"],
    }),
    isActive: (filters) => filters.categories.includes("Lunch"),
  },
  {
    id: "dinner",
    label: "Dinner",
    apply: (filters) => ({
      ...filters,
      categories: filters.categories.includes("Dinner") ? [] : ["Dinner"],
    }),
    isActive: (filters) => filters.categories.includes("Dinner"),
  },
  {
    id: "vegetarian",
    label: "Vegetarian",
    apply: (filters) => ({
      ...filters,
      searchTags: filters.searchTags.includes("vegetarian")
        ? filters.searchTags.filter((tag) => tag !== "vegetarian")
        : [...filters.searchTags, "vegetarian"],
    }),
    isActive: (filters) => filters.searchTags.includes("vegetarian"),
  },
];
