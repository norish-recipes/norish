import type { PickerKind } from "./entry-matching";

/** The Content page's lists, in the order of its tabs. */
export const CONTENT_LISTS = ["tags", "cuisines", "categories", "ingredients"] as const;

export type ContentList = (typeof CONTENT_LISTS)[number];

/** The lists of Tags, Cuisines and Categories, by the kind the server keeps them under. */
export const ENTRY_KINDS = {
  tags: "tag",
  cuisines: "cuisine",
  categories: "category",
} as const satisfies Partial<Record<ContentList, PickerKind>>;

/** The lists of plain named entries; Ingredients is the catalogue. */
export type EntryContentList = keyof typeof ENTRY_KINDS;

export const isContentList = (value: unknown): value is ContentList =>
  CONTENT_LISTS.some((list) => list === value);
