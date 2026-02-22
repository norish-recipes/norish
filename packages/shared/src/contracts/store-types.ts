export type SortOrder = "titleAsc" | "titleDesc" | "dateAsc" | "dateDesc" | "none";
export type FilterMode = "AND" | "OR";
export type SearchField = "title" | "description" | "ingredients" | "steps" | "tags";

export const SEARCH_FIELDS: readonly SearchField[] = [
  "title",
  "description",
  "ingredients",
  "steps",
  "tags",
] as const;

export const DEFAULT_SEARCH_FIELDS: readonly SearchField[] = ["title", "ingredients"] as const;
