// The whitespace `String.trim` takes, spelled out so JavaScript and PostgreSQL regexes read it alike.
const SPACE =
  "[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";

/** A `#` line in the ingredients or steps titles the lines under it; a regex source for JS and SQL. */
export const HEADING_LINE = `^${SPACE}*#`;

/** What a heading drops for its text: the marks and the whitespace around it (replace globally). */
export const HEADING_MARKS = `^${SPACE}*#+${SPACE}*|${SPACE}+$`;

/** The heading's text, or null when the line is no heading. */
export function headingText(line: string): string | null {
  return new RegExp(HEADING_LINE).test(line)
    ? line.replace(new RegExp(HEADING_MARKS, "g"), "")
    : null;
}
