import { plainText, snippetText } from "@/lib/plain-text";

import type { LibraryMatchDTO } from "@norish/shared/contracts";
import { stripDiacritics } from "@norish/shared/lib/fold-name";
import { searchTerms, searchWords } from "@norish/shared/lib/search-terms";

export type MatchSegment = { text: string; highlighted: boolean };

/** What the card's line says: an i18n label (none for a snippet) and the matched text, split for highlighting. */
export type MatchLine = {
  labelId: string | null;
  labelValues?: { number: number };
  segments: MatchSegment[];
};

const foldChar = (text: string) => stripDiacritics(text).toLowerCase();

/**
 * `text` split around the places a search term starts a word, ignoring case and accents.
 * A term nowhere as written leaves the text whole; "a,b" also marks "a" and "b" on their own.
 */
export function highlightSegments(text: string, search: string): MatchSegment[] {
  let folded = "";
  // For each folded code unit, where its original character starts and ends in `text`.
  const starts: number[] = [];
  const ends: number[] = [];
  let at = 0;

  for (const char of text) {
    const piece = foldChar(char);

    for (let i = 0; i < piece.length; i++) {
      starts.push(at);
      ends.push(at + char.length);
    }
    folded += piece;
    at += char.length;
  }

  const marked: [number, number][] = [];

  // The terms as written and the words the server's any-word fallback ORs; one that folds away is skipped.
  const terms = [...searchTerms(search), ...searchWords(search)]
    .map(foldChar)
    .filter((term) => term.length > 0);

  for (const term of new Set(terms)) {
    for (
      let from = folded.indexOf(term);
      from !== -1 && from < folded.length;
      from = folded.indexOf(term, from + 1)
    ) {
      const startsWord = from === 0 || !/[\p{L}\p{N}]/u.test(folded[from - 1]!);

      if (startsWord) marked.push([starts[from]!, ends[from + term.length - 1]!]);
    }
  }

  marked.sort((a, b) => a[0] - b[0]);

  const segments: MatchSegment[] = [];
  let cursor = 0;

  for (const [start, end] of marked) {
    if (end <= cursor) continue;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), highlighted: false });

    const previous = segments.at(-1);
    const piece = text.slice(Math.max(start, cursor), end);

    if (previous?.highlighted) previous.text += piece;
    else segments.push({ text: piece, highlighted: true });
    cursor = end;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlighted: false });

  return segments.length > 0 ? segments : [{ text, highlighted: false }];
}

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
