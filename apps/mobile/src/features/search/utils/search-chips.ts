import type { HiddenItemVisibility } from "@norish/shared-react/reader";
import type {
  CanonicalRecipeFilters,
  FilterIngredient,
} from "@norish/shared/contracts/filter-contract";
import { COOKING_TIME_OPTIONS } from "@norish/shared-react/recipes";

type Patch = Partial<CanonicalRecipeFilters>;

/** How a chip says its filter: a message by id, and a category by its name. */
export type ChipSpeech = {
  say: (id: string, values?: Record<string, string | number>) => string;
  category: (name: string) => string;
};

/** What one kind of chip knows: the values it is applied with, how it reads and how it is removed. */
type ChipKind<V> = {
  values: (filters: CanonicalRecipeFilters) => V[];
  label: (value: V, speech: ChipSpeech) => string;
  remove: (filters: CanonicalRecipeFilters, value: V) => Patch;
  /** What tells one value from another, for a key; absent for the value itself. */
  key?: (value: V) => string;
  /** Whether the reader's Hidden Items leave this filter on offer; absent for always. */
  offered?: (visibility: HiddenItemVisibility) => boolean;
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
  ingredient: kind<FilterIngredient>({
    values: (filters) => filters.ingredients,
    label: (value) => value.name,
    key: (value) => value.id,
    remove: (filters, value) => ({
      ingredients: filters.ingredients.filter((item) => item.id !== value.id),
    }),
  }),
  time: kind<number>({
    values: (filters) => (filters.maxCookingTime === null ? [] : [filters.maxCookingTime]),
    label: (value, { say }) => {
      const option = COOKING_TIME_OPTIONS.find((item) => item.value === value);

      return say(option ? `common.filters.${option.labelKey}` : "common.filters.cookingTime");
    },
    remove: () => ({ maxCookingTime: null }),
  }),
  rating: kind<number>({
    values: (filters) => (filters.minRating === null ? [] : [filters.minRating]),
    label: (value, { say }) => say("recipes.search.ratingChip", { count: value }),
    remove: () => ({ minRating: null }),
    offered: (visibility) => visibility.showRatings,
  }),
  favorites: kind<true>({
    values: (filters) => (filters.showFavoritesOnly ? [true] : []),
    label: (_value, { say }) => say("common.filters.favorites"),
    remove: () => ({ showFavoritesOnly: false }),
    offered: (visibility) => visibility.showFavorites,
  }),
  pantry: kind<true>({
    values: (filters) => (filters.showPantryOnly ? [true] : []),
    label: (_value, { say }) => say("common.filters.pantryOnly"),
    remove: () => ({ showPantryOnly: false }),
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

/** Whether a chip filters, not counting the text: the text is the field's, not a chip. */
export const hasChips = (filters: CanonicalRecipeFilters) => filterChips(filters).length > 0;

/** What `chip` says. */
export const chipLabel = (chip: FilterChip, speech: ChipSpeech) =>
  kindOf(chip).label(chip.value, speech);

/** `filters` less `chip`, as the patch to apply. */
export const withoutChip = (filters: CanonicalRecipeFilters, chip: FilterChip): Patch =>
  kindOf(chip).remove(filters, chip.value);

/** The patch that drops the filters the reader's Hidden Items took off offer, so none narrows the
 * list unseen; null when none is. */
export function withoutHiddenFilters(
  filters: CanonicalRecipeFilters,
  visibility: HiddenItemVisibility
): Patch | null {
  const hidden = filterChips(filters).filter(
    (chip) => kindOf(chip).offered?.(visibility) === false
  );

  return hidden.length === 0
    ? null
    : Object.assign({}, ...hidden.map((chip) => withoutChip(filters, chip)));
}

/** `filters` as Search reads them: without the favourites and rating filters Hidden Items hides, so
 * none narrows the list or shows a chip. */
export function visibleFilters(filters: CanonicalRecipeFilters, visibility: HiddenItemVisibility) {
  const hidden = withoutHiddenFilters(filters, visibility);

  return hidden ? { ...filters, ...hidden } : filters;
}

/** A key for a chip that is stable while the others come and go. */
export const chipKey = (chip: FilterChip) =>
  `${chip.kind}:${kindOf(chip).key?.(chip.value) ?? String(chip.value)}`;
