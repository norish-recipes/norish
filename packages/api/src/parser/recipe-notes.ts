import * as cheerio from "cheerio";

/** Where recipe card plugins keep a recipe's notes: JSON-LD has no field for them. */
const NOTES_SELECTOR = ".wprm-recipe-notes, .tasty-recipes-notes-body";

const REMOVED = "script, style, noscript, iframe, svg, button, form";
const BLOCKS = "p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote";

/** Marks a line end in the text, where the page's own newlines are only whitespace. */
const LINE_BREAK = " ";
const LIST_ITEM = /^(?:-|\d+\.) /;

function joinLines(lines: string[]): string {
  return lines.reduce((notes, line, index) => {
    if (index === 0) return line;

    const inList = LIST_ITEM.test(line) && LIST_ITEM.test(lines[index - 1]!);

    return `${notes}${inList ? "\n" : "\n\n"}${line}`;
  }, "");
}

/**
 * The notes from the page's recipe card, as Markdown text, or undefined when it has none. A page
 * with several recipe cards has several notes, and nothing says which belongs to the recipe.
 */
export function extractRecipeNotes(html: string): string | undefined {
  const $ = cheerio.load(html);
  const $notes = $(NOTES_SELECTOR);

  if ($notes.length !== 1) return undefined;

  $notes.find(REMOVED).remove();
  $notes.find("ol").each((_, list) => {
    $(list)
      .children("li")
      .each((index, item) => {
        $(item).prepend(`${index + 1}. `);
      });
  });
  $notes.find("ul").children("li").prepend("- ");
  $notes.find("br").replaceWith(LINE_BREAK);
  // A list item's first paragraph stays on the line that holds its marker.
  $notes.find(BLOCKS).not("li > p:first-child").before(LINE_BREAK).after(LINE_BREAK);
  // WP Recipe Maker writes each paragraph as a span directly inside the notes.
  $notes.children("span").before(LINE_BREAK).after(LINE_BREAK);

  const lines = $notes
    .text()
    .split(LINE_BREAK)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return lines.length > 0 ? joinLines(lines) : undefined;
}
