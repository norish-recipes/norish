import type { SQL } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { LibraryMatchDTO } from "@norish/shared/contracts/dto/cookbook";
import type { SearchField } from "@norish/shared/contracts/store-types";
import { db } from "@norish/db/drizzle";
import { HEADING_LINE, HEADING_MARKS } from "@norish/shared/lib/heading-line";
import { searchWords } from "@norish/shared/lib/search-terms";

import { recipeIngredients, recipes, recipeTags, steps as stepsTable, tags } from "../schema";
import { lineNamesKindSql } from "./ingredient-kinds";
import { searchTsqueryTerms } from "./recipes";

const qb = new QueryBuilder();
const matchLine = alias(recipeIngredients, "match_ri");
const matchStep = alias(stepsTable, "match_step");
const matchTagLink = alias(recipeTags, "match_rt");
const matchTag = alias(tags, "match_tag");

/** One fragment around the hit; ts_headline takes no empty markers, so these are stripped after. */
const MATCH_SNIPPET_OPTIONS =
  "MaxFragments=1, MinWords=6, MaxWords=14, StartSel=\uE000, StopSel=\uE001";
const plainSnippet = (snippet: string) => snippet.replace(/[\uE000\uE001]/g, "");

/** The recipe's first line (in the order the page reads them) that `condition` accepts, as written.
 * Correlated on the outer query's recipe; the line is `matchLine`. */
function ingredientLine(condition: SQL) {
  return qb
    .select({
      line: sql`CASE WHEN ${matchLine.name} ~ ${HEADING_LINE}
        THEN json_build_object('amount', NULL, 'unit', NULL,
          'name', regexp_replace(${matchLine.name}, ${HEADING_MARKS}, '', 'g'))
        ELSE json_build_object(
          'amount', ${matchLine.amount}, 'unit', ${matchLine.unit}, 'name', ${matchLine.name}) END`,
    })
    .from(matchLine)
    .where(and(eq(matchLine.recipeId, recipes.id), condition))
    .orderBy(
      sql`(${matchLine.name} ~ ${HEADING_LINE})`,
      sql`(${matchLine.systemUsed} <> ${recipes.systemUsed})`,
      sql`coalesce(${matchLine.order}, 0)`,
      sql`${matchLine.order} NULLS LAST`,
      matchLine.createdAt,
      matchLine.id
    )
    .limit(1);
}

type IngredientMatch = { amount: number | null; unit: string | null; name: string };

type MatchRow = {
  id: string;
  titleHit: boolean;
  tag: string | null;
  ingredient: IngredientMatch | null;
  description: string | null;
  step: { number: number | null; snippet: string } | null;
};

/** Adds to `matches` the match each of `rows` has, by its recipe id. */
function addMatches<T extends { id: string }>(
  matches: Map<string, LibraryMatchDTO>,
  rows: T[],
  matchOf: (row: T) => LibraryMatchDTO | null
) {
  for (const row of rows) {
    const match = matchOf(row);

    if (match) matches.set(row.id, match);
  }
}

/** The recipe's first step (in the order the page reads them) that `query` finds, with its number. */
function stepMatch(query: SQL) {
  const numbered = qb
    .select({
      systemUsed: matchStep.systemUsed,
      body: sql<string>`CASE WHEN ${matchStep.step} ~ ${HEADING_LINE}
        THEN regexp_replace(${matchStep.step}, ${HEADING_MARKS}, '', 'g')
        ELSE ${matchStep.step} END`.as("body"),
      n: sql<number | null>`CASE WHEN ${matchStep.step} ~ ${HEADING_LINE} THEN NULL
        ELSE count(*) FILTER (WHERE ${matchStep.step} !~ ${HEADING_LINE}) OVER (
          PARTITION BY ${matchStep.systemUsed}
          ORDER BY coalesce(${matchStep.order}, 0), ${matchStep.order} NULLS LAST,
            ${matchStep.createdAt}, ${matchStep.id}
        ) END`.as("n"),
    })
    .from(matchStep)
    .where(eq(matchStep.recipeId, recipes.id))
    .as("numbered");

  return qb
    .select({
      step: sql`json_build_object('number', ${numbered.n},
        'snippet', ts_headline('simple', ${numbered.body}, ${query}, ${MATCH_SNIPPET_OPTIONS}))`,
    })
    .from(numbered)
    .where(sql`to_tsvector('simple', ${numbered.body}) @@ ${query}`)
    .orderBy(
      sql`(${numbered.n} IS NULL)`,
      sql`(${numbered.systemUsed} <> ${recipes.systemUsed})`,
      numbered.n
    )
    .limit(1);
}

/** One row per recipe of `ids`: what each in-scope field holds that `query` finds. */
async function recipeMatchRows(
  ids: string[],
  searchFields: SearchField[],
  query: SQL
): Promise<MatchRow[]> {
  const inScope = (field: SearchField) => searchFields.includes(field);

  return await db
    .select({
      id: recipes.id,
      titleHit: inScope("title")
        ? sql<boolean>`to_tsvector('simple', coalesce(${recipes.name}, '')) @@ ${query}`
        : sql<boolean>`false`,
      tag: inScope("tags")
        ? sql<string | null>`${qb
            .select({ name: matchTag.name })
            .from(matchTagLink)
            .innerJoin(matchTag, eq(matchTagLink.tagId, matchTag.id))
            .where(
              and(
                eq(matchTagLink.recipeId, recipes.id),
                sql`to_tsvector('simple', ${matchTag.name}) @@ ${query}`
              )
            )
            .orderBy(matchTagLink.order, matchTag.name)
            .limit(1)}`
        : sql<string | null>`NULL::text`,
      ingredient: inScope("ingredients")
        ? sql<IngredientMatch | null>`${ingredientLine(
            sql`to_tsvector('simple', ${matchLine.name}) @@ ${query}`
          )}`
        : sql<IngredientMatch | null>`NULL::json`,
      description: inScope("description")
        ? sql<
            string | null
          >`CASE WHEN to_tsvector('simple', coalesce(${recipes.description}, '')) @@ ${query}
            THEN ts_headline('simple', ${recipes.description}, ${query}, ${MATCH_SNIPPET_OPTIONS})
          END`
        : sql<string | null>`NULL::text`,
      step: inScope("steps")
        ? sql<MatchRow["step"]>`${stepMatch(query)}`
        : sql<MatchRow["step"]>`NULL::json`,
    })
    .from(recipes)
    .where(inArray(recipes.id, ids));
}

function toLibraryMatch(row: MatchRow): LibraryMatchDTO | null {
  if (row.titleHit) return { field: "title" };
  if (row.tag) return { field: "tags", tag: row.tag };
  if (row.ingredient) return { field: "ingredients", ...row.ingredient };
  if (row.description) return { field: "description", snippet: plainSnippet(row.description) };
  if (row.step) {
    const snippet = plainSnippet(row.step.snippet);

    return row.step.number === null
      ? { field: "steps", snippet }
      : { field: "steps", snippet, number: row.step.number };
  }

  return null;
}

/** The strongest hit per recipe in scope, title > tag > ingredient > description > step. A phrase
 * spanning two rows ("chicken,rice") matches no one row, so those recipes are read again as an OR
 * of its `searchWords`, the words the card highlights. */
export async function recipeSearchMatches(
  ids: string[],
  search: string | undefined,
  searchFields: SearchField[]
): Promise<Map<string, LibraryMatchDTO>> {
  const terms = search ? searchTsqueryTerms(search) : null;
  const matches = new Map<string, LibraryMatchDTO>();

  if (!search || !terms || ids.length === 0 || searchFields.length === 0) return matches;

  const words = searchWords(search)
    .map((word) => `${word}:*`)
    .join(" | ");
  const queries = [sql`to_tsquery('simple', ${terms})`];

  if (words) queries.push(sql`to_tsquery('simple', ${words})`);

  for (const query of queries) {
    const pending = ids.filter((id) => !matches.has(id));

    if (pending.length === 0) break;

    addMatches(matches, await recipeMatchRows(pending, searchFields, query), toLibraryMatch);
  }

  return matches;
}

/** The line of each recipe of `ids` that satisfied an Ingredient filter, for a search without text. */
export async function recipeIngredientMatches(
  ids: string[],
  ingredientIds: string[]
): Promise<Map<string, LibraryMatchDTO>> {
  const matches = new Map<string, LibraryMatchDTO>();

  if (ids.length === 0 || ingredientIds.length === 0) return matches;

  const rows = await db
    .select({
      id: recipes.id,
      ingredient: sql<IngredientMatch | null>`${ingredientLine(
        lineNamesKindSql(matchLine.id, ingredientIds)
      )}`,
    })
    .from(recipes)
    .where(inArray(recipes.id, ids));

  addMatches(matches, rows, ({ ingredient }) =>
    ingredient ? { field: "ingredients", ...ingredient } : null
  );

  return matches;
}
