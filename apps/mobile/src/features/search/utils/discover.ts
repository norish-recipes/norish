export type DiscoverSection = "recent" | "categories" | "quickFilters" | "tags";

/** A section's read: how many it loaded (cached data counts), or that it is loading or failed. */
export type SectionRead = number | "loading" | "failed";

/** What the sections' choice reads. */
export type DiscoverInput = {
  /** The keyboard is up: only Recent and Categories show behind the field. */
  focused: boolean;
  recentCount: number;
  categories: SectionRead;
  tags: SectionRead;
  /** The app is Offline: a read with nothing cached will not resolve, so it shows nothing. */
  offline: boolean;
};

// A loading section shows its skeleton, except Offline; a failed or empty one is left out.
const shows = (read: SectionRead, offline: boolean) =>
  (read === "loading" && !offline) || (typeof read === "number" && read > 0);

/** The sections to show, in order: Recent only when there is one, Quick filters and Tags only
 * with the keyboard down. */
export function discoverSections({
  focused,
  recentCount,
  categories,
  tags,
  offline,
}: DiscoverInput): DiscoverSection[] {
  const sections: DiscoverSection[] = [];

  if (recentCount > 0) sections.push("recent");
  if (shows(categories, offline)) sections.push("categories");
  if (focused) return sections;

  sections.push("quickFilters");
  if (shows(tags, offline)) sections.push("tags");

  return sections;
}
