import { decode } from "html-entities";

import { extractSanitizedBody } from "@norish/api/parser/extraction-sanitizer";
import { collectSteps } from "@norish/api/parser/parsers/steps";

/** The most page text a model reads, as for a page sent on its own. */
const PAGE_TEXT_LIMIT = 50_000;
/** Enough of the last step to find it, short enough that a site's edits near its end don't matter. */
const LAST_STEP_KEY_LENGTH = 40;
const MIN_TITLE_LENGTH = 3;
const MIN_LAST_STEP_LENGTH = 8;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** Lowercase letters and digits only, so spacing and punctuation never decide a match. */
function squeeze(text: string): { squeezed: string; sourceIndex: number[] } {
  let squeezed = "";
  const sourceIndex: number[] = [];
  let index = 0;

  for (const character of text) {
    if (LETTER_OR_DIGIT.test(character)) {
      for (const lower of character.toLowerCase()) {
        squeezed += lower;
        sourceIndex.push(index);
      }
    }
    index += character.length;
  }

  return { squeezed, sourceIndex };
}

/**
 * The cleaned page from the recipe's title to the end of its last step, as JSON-LD names them, or
 * the whole cleaned page when it holds neither. JSON-LD has no room for ingredient sections.
 */
export function recipePageText(html: string, recipe: Record<string, unknown>): string {
  const body = extractSanitizedBody(html);
  const { squeezed, sourceIndex } = squeeze(body);
  const title = typeof recipe.name === "string" ? squeeze(decode(recipe.name)).squeezed : "";
  const lastStep = squeeze(collectSteps(recipe.recipeInstructions).at(-1) ?? "").squeezed;
  const from = title.length >= MIN_TITLE_LENGTH ? squeezed.indexOf(title) : -1;
  const to =
    lastStep.length >= MIN_LAST_STEP_LENGTH
      ? squeezed.lastIndexOf(lastStep.slice(0, LAST_STEP_KEY_LENGTH))
      : -1;

  if (from < 0 || to <= from) return body.slice(0, PAGE_TEXT_LIMIT);

  const lastStepEnd = sourceIndex[Math.min(to + lastStep.length, sourceIndex.length) - 1]!;
  const lineEnd = body.indexOf("\n", lastStepEnd);

  return body
    .slice(sourceIndex[from], lineEnd < 0 ? body.length : lineEnd)
    .slice(0, PAGE_TEXT_LIMIT);
}
