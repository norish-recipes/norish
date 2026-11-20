import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

import type { LibraryMatchDTO } from "@norish/shared/contracts/dto/cookbook";
import type { SearchField } from "@norish/shared/contracts/store-types";
import { db } from "@norish/db/drizzle";
import { HEADING_LINE, HEADING_MARKS } from "@norish/shared/lib/heading-line";
import { searchWords } from "@norish/shared/lib/search-terms";

import { recipeIngredients, recipes, recipeTags, steps as stepsTable, tags } from "../schema";
import { lineNamesKindSql } from "./ingredient-kinds";
import { rowsOf, uuidListSql } from "./raw-sql";
import { searchTsqueryTerms } from "./recipes";

/** One fragment around the hit; ts_headline takes no empty markers, so these are stripped after. */
const MATCH_SNIPPET_OPTIONS =
  "MaxFragments=1, MinWords=6, MaxWords=14, StartSel=\uE000, StopSel=\uE001";
const plainSnippet = (snippet: string) => snippet.replace(/[\uE000\uE001]/g, "");

/** The recipe's first line (in the order the page reads them) that `condition` accepts, as written.
 * Correlated on `"recipes"."id"`; the line is `match_ri`. */
function ingredientLineSql(condition: SQL) {
  return sql`(
    SELECT CASE WHEN match_ri.name ~ ${HEADING_LINE}
      THEN json_build_object('amount', NULL, 'unit', NULL,
        'name', regexp_replace(match_ri.name, ${HEADING_MARKS}, '', 'g'))
      ELSE json_build_object(
        'amount', match_ri.amount, 'unit', match_ri.unit, 'name', match_ri.name) END
    FROM ${recipeIngredients} match_ri
    WHERE match_ri.recipe_id = "recipes"."id" AND ${condition}
    ORDER BY (match_ri.name ~ ${HEADING_LINE}),
      (match_ri.system_used <> "recipes"."system_used"),
      coalesce(match_ri."order", 0), match_ri."order" NULLS LAST,
      match_ri.created_at, match_ri.id
    LIMIT 1
  )`;
}

type MatchRow = {
  id: string;
  title_hit: boolean;
  tag: string | null;
  ingredient: { amount: number | null; unit: string | null; name: string } | null;
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

/** One row per recipe of `ids`: what each in-scope field holds that `query` finds. */
async function recipeMatchRows(
  ids: string[],
  searchFields: SearchField[],
  query: ReturnType<typeof sql>
): Promise<MatchRow[]> {
  const inScope = (field: SearchField) => searchFields.includes(field);

  return rowsOf<MatchRow>(
    await db.execute(sql`
    SELECT "recipes"."id" AS id,
      ${
        inScope("title")
          ? sql`to_tsvector('simple', coalesce("recipes"."name", '')) @@ ${query}`
          : sql`false`
      } AS title_hit,
      ${
        inScope("tags")
          ? sql`(
              SELECT match_tag.name
              FROM ${recipeTags} match_rt
              INNER JOIN ${tags} match_tag ON match_rt.tag_id = match_tag.id
              WHERE match_rt.recipe_id = "recipes"."id"
                AND to_tsvector('simple', match_tag.name) @@ ${query}
              ORDER BY match_rt."order", match_tag.name
              LIMIT 1
            )`
          : sql`NULL::text`
      } AS tag,
      ${
        inScope("ingredients")
          ? ingredientLineSql(sql`to_tsvector('simple', match_ri.name) @@ ${query}`)
          : sql`NULL::json`
      } AS ingredient,
      ${
        inScope("description")
          ? sql`CASE WHEN to_tsvector('simple', coalesce("recipes"."description", '')) @@ ${query}
              THEN ts_headline('simple', "recipes"."description", ${query}, ${MATCH_SNIPPET_OPTIONS})
            END`
          : sql`NULL::text`
      } AS description,
      ${
        inScope("steps")
          ? sql`(
              SELECT json_build_object(
                'number', numbered.n,
                'snippet', ts_headline('simple', numbered.body, ${query}, ${MATCH_SNIPPET_OPTIONS}))
              FROM (
                SELECT match_step.system_used,
                  CASE WHEN match_step.step ~ ${HEADING_LINE}
                    THEN regexp_replace(match_step.step, ${HEADING_MARKS}, '', 'g')
                    ELSE match_step.step END AS body,
                  CASE WHEN match_step.step ~ ${HEADING_LINE} THEN NULL
                    ELSE count(*) FILTER (WHERE match_step.step !~ ${HEADING_LINE}) OVER (
                      PARTITION BY match_step.system_used
                      ORDER BY coalesce(match_step."order", 0), match_step."order" NULLS LAST,
                        match_step.created_at, match_step.id
                    ) END AS n
                FROM ${stepsTable} match_step
                WHERE match_step.recipe_id = "recipes"."id"
              ) numbered
              WHERE to_tsvector('simple', numbered.body) @@ ${query}
              ORDER BY (numbered.n IS NULL), (numbered.system_used <> "recipes"."system_used"), numbered.n
              LIMIT 1
            )`
          : sql`NULL::json`
      } AS step
    FROM ${recipes}
    WHERE "recipes"."id" IN (${uuidListSql(ids)})
  `)
  );
}

function toLibraryMatch(row: MatchRow): LibraryMatchDTO | null {
  if (row.title_hit) return { field: "title" };
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

  const rows = rowsOf<Pick<MatchRow, "id" | "ingredient">>(
    await db.execute(sql`
    SELECT "recipes"."id" AS id,
      ${ingredientLineSql(lineNamesKindSql("match_ri", ingredientIds))} AS ingredient
    FROM ${recipes}
    WHERE "recipes"."id" IN (${uuidListSql(ids)})
  `)
  );

  addMatches(matches, rows, ({ ingredient }) =>
    ingredient ? { field: "ingredients", ...ingredient } : null
  );

  return matches;
}
