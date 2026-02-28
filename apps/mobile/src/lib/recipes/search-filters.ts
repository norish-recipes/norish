export type SearchFilters = {
  /** Filter to a specific course category. Null means no category filter. */
  course: string | null;
  /** Maximum total cooking time in minutes. Null means no time filter. */
  maxCookingTime: number | null;
  /** When true, only show recipes the user has liked. */
  liked: boolean;
  /** Minimum star rating (1–5). Null means no rating filter. */
  minRating: number | null;
  /** Set of tags that must all be present on the recipe. */
  tags: Set<string>;
};

export const DEFAULT_FILTERS: SearchFilters = {
  course: null,
  maxCookingTime: null,
  liked: false,
  minRating: null,
  tags: new Set(),
};

export function isFiltersEmpty(filters: SearchFilters): boolean {
  return (
    filters.course === null &&
    filters.maxCookingTime === null &&
    !filters.liked &&
    filters.minRating === null &&
    filters.tags.size === 0
  );
}

export type FilterPreset = {
  id: string;
  label: string;
  /** Returns the filters object that activating this preset produces. */
  apply: (current: SearchFilters) => SearchFilters;
  /** Returns true when this preset is currently active given the filter state. */
  isActive: (filters: SearchFilters) => boolean;
};

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'quick',
    label: 'Quick (<30 min)',
    apply: (f) => ({ ...f, maxCookingTime: 30 }),
    isActive: (f) => f.maxCookingTime !== null && f.maxCookingTime <= 30,
  },
  {
    id: 'favorites',
    label: 'Favorites',
    apply: (f) => ({ ...f, liked: !f.liked }),
    isActive: (f) => f.liked,
  },
  {
    id: 'breakfast',
    label: 'Breakfast',
    apply: (f) => ({ ...f, course: f.course === 'Breakfast' ? null : 'Breakfast' }),
    isActive: (f) => f.course === 'Breakfast',
  },
  {
    id: 'lunch',
    label: 'Lunch',
    apply: (f) => ({ ...f, course: f.course === 'Lunch' ? null : 'Lunch' }),
    isActive: (f) => f.course === 'Lunch',
  },
  {
    id: 'dinner',
    label: 'Dinner',
    apply: (f) => ({ ...f, course: f.course === 'Dinner' ? null : 'Dinner' }),
    isActive: (f) => f.course === 'Dinner',
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    apply: (f) => {
      const next = new Set(f.tags);
      if (next.has('vegetarian')) {
        next.delete('vegetarian');
      } else {
        next.add('vegetarian');
      }
      return { ...f, tags: next };
    },
    isActive: (f) => f.tags.has('vegetarian'),
  },
];

export const COURSE_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export const COOKING_TIME_OPTIONS: { label: string; value: number }[] = [
  { label: '< 15 min', value: 15 },
  { label: '< 30 min', value: 30 },
  { label: '< 60 min', value: 60 },
  { label: '< 2 hrs', value: 120 },
];
export const ALL_TAGS = [
  'weeknight',
  'high-protein',
  'family',
  'meal-prep',
  'vegetarian',
  'fresh',
  'no-cook',
  'make-ahead',
  'quick',
  'comfort-food',
  'pantry',
  'vegan',
  'freezer-friendly',
  'budget',
] as const;
