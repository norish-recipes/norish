import type { ComponentType, SVGProps } from "react";
import { settingsHref } from "@/components/settings/settings-tab";
import { BookOpenIcon, GlobeAltIcon, Squares2X2Icon, TagIcon } from "@heroicons/react/24/outline";

import type { ContentList } from "@norish/shared-react/lists";

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
