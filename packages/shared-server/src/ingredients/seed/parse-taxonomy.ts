/**
 * The Open Food Facts ingredients taxonomy, read (ADR-0038). The file is a
 * list of entries separated by blank lines; within one entry
 *
 *   < en: onion-family vegetable      a parent, named in any of its languages
 *   en: onion, onions                 the entry's names in one language
 *   nl: ui, uien, ajuin
 *   wikidata:en: Q3406628             a property, which Norish does not read
 *
 * and `#` starts a comment. The first name line names the entry: its id is
 * that language and the first name, as Open Food Facts itself keys it
 * ("en:onion"). `xx:` names hold in every language. A block with no names
 * (the synonyms and stopwords at the top of the file) is not an entry.
 *
 * Pure: the whole file is read before anything is applied, and a line that is
 * none of these, as an HTML error page served in the file's place would be,
 * makes the whole file malformed.
 */

/** One name of an entry, in the language it is written in (null for `xx:`, every language). */
export interface TaxonomyName {
  text: string;
  locale: string | null;
}

export interface TaxonomyEntry {
  /** The entry's own key, "en:onion". */
  id: string;
  /** The name Norish calls the Ingredient: its first English name, else its first name. */
  name: string;
  /** Every name, in the file's order: the canonical one first within its language. */
  names: TaxonomyName[];
  /** The ids of the entries it is a kind of, first one first. Parents the file does not have are dropped. */
  parentIds: string[];
}

export class TaxonomyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxonomyParseError";
  }
}

const LANGUAGE = "[a-z]{2,3}(?:[_-][a-z]+)?";
const PARENT_LINE = new RegExp(`^<\\s*(${LANGUAGE}):\\s*(.+)$`);
const PROPERTY_LINE = new RegExp(`^[a-z0-9_-]+:${LANGUAGE}:`);
const NAME_LINE = new RegExp(`^(${LANGUAGE}):\\s*(.*)$`);

/** The language-free marker: a name that holds in every language. */
const EVERY_LANGUAGE = "xx";

/** How Open Food Facts keys a name: lowercase, with its spaces as dashes. */
function keyOf(locale: string, text: string): string {
  return `${locale}:${text.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

/** A line's names: split on commas that are not escaped (`\,` is a comma inside a name). */
function namesOf(list: string): string[] {
  return list
    .split(/(?<!\\),/)
    .map((name) => name.replace(/\\,/g, ",").trim())
    .filter((name) => name.length > 0);
}

interface RawEntry {
  names: Array<TaxonomyName & { lang: string }>;
  parentKeys: string[];
}

export function parseTaxonomy(file: string): TaxonomyEntry[] {
  const blocks: RawEntry[] = [];
  let current: RawEntry = { names: [], parentKeys: [] };
  const close = () => {
    if (current.names.length > 0) blocks.push(current);
    current = { names: [], parentKeys: [] };
  };

  file.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();

    if (line === "") return close();
    if (line.startsWith("#")) return;

    const parent = PARENT_LINE.exec(line);

    if (parent) {
      current.parentKeys.push(keyOf(parent[1]!, parent[2]!));

      return;
    }
    if (PROPERTY_LINE.test(line)) return;

    const names = NAME_LINE.exec(line);

    if (!names) {
      throw new TaxonomyParseError(
        `Line ${index + 1} is not part of a taxonomy: ${line.slice(0, 80)}`
      );
    }

    const lang = names[1]!;

    for (const text of namesOf(names[2]!)) {
      current.names.push({ text, lang, locale: lang === EVERY_LANGUAGE ? null : lang });
    }
  });
  close();

  if (blocks.length === 0) throw new TaxonomyParseError("The taxonomy has no entries");

  // Every name of every entry keys it, so a parent named by any of its names is found.
  const idByKey = new Map<string, string>();
  const ids = new Set<string>();
  const entries: Array<TaxonomyEntry & { parentKeys: string[] }> = [];

  for (const block of blocks) {
    const first = block.names[0]!;
    const id = keyOf(first.lang, first.text);

    // An entry the file lists twice is the first one.
    if (ids.has(id)) continue;
    ids.add(id);

    for (const name of block.names) {
      const key = keyOf(name.lang, name.text);

      if (!idByKey.has(key)) idByKey.set(key, id);
    }
    entries.push({
      id,
      name: (block.names.find((name) => name.lang === "en") ?? first).text,
      names: block.names.map(({ text, locale }) => ({ text, locale })),
      parentIds: [],
      parentKeys: block.parentKeys,
    });
  }

  return entries.map(({ parentKeys, ...entry }) => ({
    ...entry,
    parentIds: [
      ...new Set(
        parentKeys.flatMap((key) => {
          const parentId = idByKey.get(key);

          return parentId && parentId !== entry.id ? [parentId] : [];
        })
      ),
    ],
  }));
}
