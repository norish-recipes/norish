/**
 * Ticket 16 (spike): the parent the words of a name file it under, over Mike's real set, with the
 * candidate signals for when an unsure one is safe. Read-only. Copy into packages/shared-server, run there:
 *   DATABASE_URL=…/<clone of norish_prod_pristine> node <tsx cli> words-parents.ts <dir>
 * <dir> holds texts.json (line texts and own food names) and children.json (children per seeded off_id).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { ingredientAliases, ingredients } from "@norish/db/schema";
import { getIngredientWords, getUnits } from "@norish/shared-server/config/server-config-loader";
import { cleanIngredientText, parentFromWordsOf } from "@norish/shared-server/ingredients/resolver";
import { spellingKeys, spellingRules } from "@norish/shared/lib/spelling-keys";

const dir = process.argv[2]!;
const texts: Array<{ source: "line" | "food"; text: string; uses: number }> = JSON.parse(
  readFileSync(join(dir, "texts.json"), "utf8")
);
const children: Record<string, number> = JSON.parse(readFileSync(join(dir, "children.json"), "utf8"));

// Not in the Ingredient Words: the colours a name may lead with, tested as a signal of their own.
const COLOURS = new Set(
  "red green yellow white black brown purple orange pink rode groene gele witte zwarte bruine paarse oranje roze rood groen geel wit zwart bruin paars".split(
    " "
  )
);

const units = await getUnits();
const words = await getIngredientWords();
const rules = spellingRules(units, words);
const languagesOf = new Map<string, Set<string>>();

for (const [language, set] of Object.entries(words ?? {})) {
  for (const word of [...(set.preparation ?? []), ...(set.sizes ?? [])]) {
    const fold = spellingKeys(word, rules).fold;

    if (!languagesOf.has(fold)) languagesOf.set(fold, new Set());
    languagesOf.get(fold)!.add(language);
  }
}

const rows = [];

for (const { source, text, uses } of texts) {
  const parent = await parentFromWordsOf(text);

  if (!parent) continue;
  const keys = spellingKeys(cleanIngredientText(text), rules);
  const all = (keys.plainFold || keys.bareFold || keys.fold).split(" ");
  const cut = all.findIndex((word, index) => index > 0 && rules.servedWith.has(word));
  const read = cut > 0 ? all.slice(0, cut) : all;
  const [food] = await db
    .select({ name: ingredients.name, offId: ingredients.offId })
    .from(ingredients)
    .where(eq(ingredients.id, parent.id));
  const spellings = await db
    .select({ fold: ingredientAliases.fold, locale: ingredientAliases.locale })
    .from(ingredientAliases)
    .where(and(eq(ingredientAliases.ingredientId, parent.id), isNotNull(ingredientAliases.fold)));
  const folds = new Map(spellings.map((spelling) => [spelling.fold, spelling.locale]));
  // The window parentFromWords took: longest first, an unsure one never the words' tail.
  let match: { fold: string; locale: string | null; start: number; length: number } | null = null;

  for (let length = read.length; length >= 1 && !match; length -= 1) {
    for (let start = read.length - length; start >= 0 && !match; start -= 1) {
      const fold = read.slice(start, start + length).join(" ");

      if (folds.has(fold) && (start === read.length - length) === parent.sure) {
        match = { fold, locale: folds.get(fold) ?? null, start, length };
      }
    }
  }

  const rest = match
    ? [...read.slice(0, match.start), ...read.slice(match.start + match.length)]
    : read;
  const onlyWords = (allowed: (word: string) => boolean) => rest.length > 0 && rest.every(allowed);
  const restLanguages = rest.flatMap((word) => [...(languagesOf.get(word) ?? [])]);

  rows.push({
    source,
    uses,
    text,
    read: all.join(" "),
    parentFirst: match?.start === 0,
    parent: food?.name ?? "?",
    spelling: match?.fold ?? "?",
    locale: match?.locale ?? null,
    sure: parent.sure,
    rest: rest.join(" "),
    prepOrSize: onlyWords((word) => rules.preparation.has(word) || rules.sizes.has(word)),
    prepSizeOrColour: onlyWords(
      (word) => rules.preparation.has(word) || rules.sizes.has(word) || COLOURS.has(word)
    ),
    noChildren: !(food?.offId && children[food.offId]),
    sameLanguage:
      match?.locale != null && restLanguages.length > 0 && restLanguages.includes(match.locale),
  });
}

writeFileSync(join(dir, "parents.json"), JSON.stringify(rows, null, 1));
console.log(
  JSON.stringify({
    texts: texts.length,
    withParent: rows.length,
    sure: rows.filter((row) => row.sure).length,
    unsure: rows.filter((row) => !row.sure).length,
    unsureFoods: rows.filter((row) => !row.sure && row.source === "food").length,
  })
);
process.exit(0);
