import type { MatchSegment } from "@/lib/highlight-segments";
import { highlightSegments } from "@/lib/highlight-segments";
import { plainText, snippetText } from "@/lib/plain-text";

import type { LibraryMatchDTO } from "@norish/shared/contracts";

/** What the card's line says: an i18n label (none for a snippet) and the matched text, split for highlighting. */
export type MatchLine = {
  labelId: string | null;
  labelValues?: { number: number };
  segments: MatchSegment[];
};

/** The match line the card shows in place of its description while searching. `ingredientPrefix` is the line's formatted amount and unit. */
export function matchLine(
  match: LibraryMatchDTO,
  search: string,
  ingredientPrefix = ""
): MatchLine {
  switch (match.field) {
    case "title":
      return { labelId: "recipes.search.matchTitle", segments: [] };
    case "tags":
      return {
        labelId: "recipes.search.matchTag",
        segments: highlightSegments(match.tag, search),
      };
    case "ingredients":
      return {
        labelId: "recipes.search.matchIngredient",
        segments: [
          ...(ingredientPrefix ? [{ text: `${ingredientPrefix} `, highlighted: false }] : []),
          ...highlightSegments(plainText(match.name), search),
        ],
      };
    case "steps": {
      const segments = highlightSegments(snippetText(match.snippet), search);

      return match.number === undefined
        ? { labelId: null, segments }
        : {
            labelId: "recipes.search.matchStep",
            labelValues: { number: match.number },
            segments,
          };
    }
    case "description":
      return { labelId: null, segments: highlightSegments(snippetText(match.snippet), search) };
  }
}
