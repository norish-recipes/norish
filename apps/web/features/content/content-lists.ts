import type { ComponentType, SVGProps } from "react";
import { settingsHref } from "@/components/settings/settings-tab";
import { BookOpenIcon, GlobeAltIcon, Squares2X2Icon, TagIcon } from "@heroicons/react/24/outline";

import type { PickerKind } from "@norish/shared-react/lists";

export const CONTENT_LISTS = ["tags", "cuisines", "categories", "ingredients"] as const;

export type ContentList = (typeof CONTENT_LISTS)[number];

/** The lists of Tags, Cuisines and Categories, by the kind the server keeps them under. */
export const ENTRY_KINDS = {
  tags: "tag",
  cuisines: "cuisine",
  categories: "category",
} as const satisfies Partial<Record<ContentList, PickerKind>>;

export const LIST_ICONS: Record<ContentList, ComponentType<SVGProps<SVGSVGElement>>> = {
  tags: TagIcon,
  cuisines: GlobeAltIcon,
  categories: Squares2X2Icon,
  ingredients: BookOpenIcon,
};

/** The list the Content tab opens on. */
export const DEFAULT_CONTENT_LIST: ContentList = "tags";

/** A list's address: the chosen list is in the URL, so a reload or a shared link lands on it. */
export function contentHref(list: ContentList) {
  return `${settingsHref("content")}/${list}`;
}

export function isContentList(value: string): value is ContentList {
  return CONTENT_LISTS.some((list) => list === value);
}
