import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

import type {
  CookbookSummaryDTO,
  FilterMode,
  LibraryTypeFilter,
  RecipeCategory,
  RecipeDashboardDTO,
  SearchField,
  SortOrder,
} from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";

import type { RecipeListContext } from "./recipes";
import {
  cookbooks,
  recipeFavorites,
  recipeRatings,
  recipes,
  recipeTags,
  tags as tagsTable,
} from "../schema";
import { cookbookTitleMatch, listCookbooksByIds } from "./cookbooks";
import { buildOwnerPolicyCondition, listDashboardRecipesByIds, recipeSearchSql } from "./recipes";

export type LibraryListParams = {
  limit: number;
  offset?: number;
  search?: string;
  searchFields?: SearchField[];
  tags?: string[];
  filterMode?: FilterMode;
  sortMode?: SortOrder;
  minRating?: number;
  maxCookingTime?: number;
  categories?: RecipeCategory[];
  favoritesOnly?: boolean;
  type?: LibraryTypeFilter;
};

/** One row of the Library, discriminated by what kind of thing it is. */
export type LibraryListItem =
  | { kind: "recipe"; recipe: RecipeDashboardDTO }
  | { kind: "cookbook"; cookbook: CookbookSummaryDTO };

/**
 * Both kinds carry a title and a creation date, so all four sort modes apply
 * to both without inventing anything (ADR-0026). The tie-break on `id` is
 * what stops paging repeating or skipping a row when two titles or two
 * timestamps are equal.
 */
const LIBRARY_ORDER_BY: Record<SortOrder, SQL> = {
  titleAsc: sql`title ASC`,
  titleDesc: sql`title DESC`,
  dateAsc: sql`created_at ASC`,
  dateDesc: sql`created_at DESC`,
  none: sql`created_at DESC`,
};

/** Filters that mean nothing for a cookbook, so an active one drops them. */
function hasRecipeOnlyFilter(params: LibraryListParams): boolean {
  return (
    params.minRating !== undefined ||
    params.maxCookingTime !== undefined ||
    (params.categories?.length ?? 0) > 0 ||
    (params.tags?.length ?? 0) > 0 ||
    params.favoritesOnly === true
  );
}

function rowsOf<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/**
 * One paginated list over recipes and cookbooks together — the Library.
 *
 * The union carries only what every sort mode needs (a kind, an id, a title
 * and a creation date) plus the two columns search needs, and the page it
 * lands on is hydrated into full cards afterwards. Ordering, paging and the
 * type filter all happen in SQL, so `total` counts both kinds — nothing may
 * read it as a recipe count — and a page has no gaps and no repeats.
 *
 * Search is the one place the two kinds are not comparable. A cookbook has
 * only a title to offer and `ts_rank` normalises by length, so a matching
 * cookbook is *pinned* above the relevance-ranked recipes rather than scored
 * against them; a reader who unticks Title in "Search in" takes cookbooks out
 * of search entirely, which is the honest reading of that control (ADR-0026).
 *
 * Recipe-only filters — rating, cooking time, categories, tags, favourites —
 * drop cookbooks out the same way a recipe missing that data drops out.
 *
 * The recipe branch's correlated subqueries spell `"recipes"."…"` by hand:
 * an interpolated drizzle column renders unqualified, which inside a
 * subquery resolves to the wrong table and silently matches nothing.
 */
export async function listLibrary(
  ctx: RecipeListContext,
  params: LibraryListParams
): Promise<{ items: LibraryListItem[]; total: number }> {
  const {
    limit,
    offset = 0,
    search,
    searchFields = ["title", "ingredients"],
    tags,
    filterMode = "AND",
    sortMode = "dateDesc",
    minRating,
    maxCookingTime,
    categories,
    favoritesOnly,
    type = "all",
  } = params;

  const searchSql = recipeSearchSql(search, searchFields);
  const cookbookTitleCondition = search ? cookbookTitleMatch(search) : undefined;
  const includeRecipes = type !== "cookbooks";
  const includeCookbooks =
    type !== "recipes" &&
    !hasRecipeOnlyFilter(params) &&
    // A cookbook matches on its title alone.
    (!search || (searchFields.includes("title") && cookbookTitleCondition !== undefined));

  if (!includeRecipes && !includeCookbooks) {
    return { items: [], total: 0 };
  }

  const branches: SQL[] = [];

  if (includeRecipes) {
    const conditions: SQL[] = [];
    const policyCondition = await buildOwnerPolicyCondition(ctx, recipes.userId, "view");

    if (policyCondition) conditions.push(policyCondition as SQL);
    if (searchSql) conditions.push(searchSql.match);

    if (categories?.length) {
      conditions.push(
        sql`"recipes"."categories" && ${`{${categories.join(",")}}`}::recipe_category[]`
      );
    }

    if (maxCookingTime !== undefined) {
      conditions.push(sql`(
        ("recipes"."total_minutes" IS NOT NULL
          OR "recipes"."prep_minutes" IS NOT NULL
          OR "recipes"."cook_minutes" IS NOT NULL)
        AND (CASE WHEN "recipes"."total_minutes" IS NOT NULL THEN "recipes"."total_minutes"
                  ELSE COALESCE("recipes"."prep_minutes", 0) + COALESCE("recipes"."cook_minutes", 0)
             END) <= ${maxCookingTime}
      )`);
    }

    if (minRating !== undefined) {
      // In SQL rather than post-fetch, so a page of the union has no gaps.
      conditions.push(sql`COALESCE((
        SELECT AVG(rating.rating) FROM ${recipeRatings} AS rating
        WHERE rating.recipe_id = "recipes"."id"
      ), -1) >= ${minRating}`);
    }

    if (favoritesOnly) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${recipeFavorites} AS favorite
        WHERE favorite.recipe_id = "recipes"."id" AND favorite.user_id = ${ctx.userId}
      )`);
    }

    if (tags?.length) {
      const normalized = tags.map((tag) => tag.toLowerCase());
      const required = filterMode === "AND" ? normalized.length : 1;

      // One bound parameter per name: an interpolated JS array would reach
      // Postgres as a single text value and fail as a malformed array literal.
      const nameList = sql.join(
        normalized.map((tag) => sql`${tag}`),
        sql`, `
      );

      conditions.push(sql`(
        SELECT COUNT(DISTINCT lower(filter_tag.name))
        FROM ${recipeTags} AS filter_rt
        INNER JOIN ${tagsTable} AS filter_tag ON filter_rt.tag_id = filter_tag.id
        WHERE filter_rt.recipe_id = "recipes"."id"
          AND lower(filter_tag.name) IN (${nameList})
      ) >= ${required}`);
    }

    branches.push(sql`
      SELECT 'recipe'::text AS kind,
             "recipes"."id" AS id,
             "recipes"."name" AS title,
             "recipes"."created_at" AS created_at,
             0 AS pinned,
             ${searchSql ? searchSql.rank : sql`0::real`} AS rank
      FROM ${recipes}
      ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
  }

  if (includeCookbooks) {
    const conditions: SQL[] = [];
    const policyCondition = await buildOwnerPolicyCondition(ctx, cookbooks.userId, "view");

    if (policyCondition) conditions.push(policyCondition as SQL);
    if (cookbookTitleCondition) conditions.push(sql`(${cookbookTitleCondition})`);

    branches.push(sql`
      SELECT 'cookbook'::text AS kind,
             "cookbooks"."id" AS id,
             "cookbooks"."title" AS title,
             "cookbooks"."created_at" AS created_at,
             ${search ? sql`1` : sql`0`} AS pinned,
             0::real AS rank
      FROM ${cookbooks}
      ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
  }

  const union = sql.join(branches, sql` UNION ALL `);
  const baseOrder = LIBRARY_ORDER_BY[sortMode] ?? LIBRARY_ORDER_BY.dateDesc;
  const orderBy = search
    ? sql`ORDER BY pinned DESC, rank DESC, ${baseOrder}, id ASC`
    : sql`ORDER BY ${baseOrder}, id ASC`;

  const [pageResult, totalResult] = await Promise.all([
    db.execute(
      sql`WITH library AS (${union}) SELECT kind, id FROM library ${orderBy} LIMIT ${limit} OFFSET ${offset}`
    ),
    db.execute(sql`WITH library AS (${union}) SELECT COUNT(*)::int AS total FROM library`),
  ]);

  const page = rowsOf<{ kind: string; id: string }>(pageResult);
  const total = Number(rowsOf<{ total: number | string }>(totalResult)[0]?.total ?? 0);

  const [recipeCards, cookbookCards] = await Promise.all([
    listDashboardRecipesByIds(page.filter((row) => row.kind === "recipe").map((row) => row.id)),
    listCookbooksByIds(
      ctx,
      page.filter((row) => row.kind === "cookbook").map((row) => row.id)
    ),
  ]);

  const recipesById = new Map(recipeCards.map((recipe) => [recipe.id, recipe]));
  const cookbooksById = new Map(cookbookCards.map((cookbook) => [cookbook.id, cookbook]));

  const items = page.flatMap<LibraryListItem>((row) => {
    if (row.kind === "recipe") {
      const recipe = recipesById.get(row.id);

      return recipe ? [{ kind: "recipe" as const, recipe }] : [];
    }

    const cookbook = cookbooksById.get(row.id);

    return cookbook ? [{ kind: "cookbook" as const, cookbook }] : [];
  });

  return { items, total };
}
