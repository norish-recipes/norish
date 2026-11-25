import type { SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type {
  CookbookSummaryDTO,
  FilterMode,
  LibraryDiscoverDTO,
  LibraryMatchDTO,
  LibrarySuggestionsDTO,
  LibraryTypeFilter,
  RecipeCategory,
  RecipeDashboardDTO,
  SearchField,
  SortOrder,
} from "@norish/shared/contracts";
import type { IngredientSearch } from "@norish/shared/lib/ingredient-search";
import { db } from "@norish/db/drizzle";
import { BUILT_IN_CATEGORIES } from "@norish/shared/lib/categories";
import { entryFold } from "@norish/shared/lib/fold-name";
import { parseIngredientSearch } from "@norish/shared/lib/ingredient-search";
import { hasSearchText } from "@norish/shared/lib/search-terms";

import type { RecipeListContext } from "./recipes";
import {
  categories,
  cookbooks,
  ingredientAliases,
  ingredients,
  recipeCategories,
  recipeFavorites,
  recipeIngredientFoods,
  recipeIngredients,
  recipeRatings,
  recipes,
  recipeTags,
  tags as tagsTable,
} from "../schema";
import { cookbookTitleMatch, listCookbooksByIds } from "./cookbooks";
import { findLocaleNames } from "./ingredient-aliases";
import { matchingSearch, nameStartsWith } from "./ingredient-catalogue";
import { kindWalkSql, lineNamesKindSql } from "./ingredient-kinds";
import { inScope, recipeCarriesFoldsSql } from "./list-entries";
import { pantryCoverageSql } from "./pantry-coverage";
import { rowsOf, uuidListSql } from "./raw-sql";
import { recipeIngredientMatches, recipeSearchMatches } from "./recipe-matches";
import { PRIMARY_IMAGE_SQL } from "./recipe-primary-image";
import { buildPolicyCondition, listDashboardRecipesByIds, recipeSearchSql } from "./recipes";

export type LibraryListParams = {
  limit: number;
  offset?: number;
  search?: string;
  searchFields?: SearchField[];
  tags?: string[];
  /** Ingredient ids: a recipe needs a line naming each (or one, under Any) or a kind of it. */
  ingredientIds?: string[];
  filterMode?: FilterMode;
  sortMode?: SortOrder;
  minRating?: number;
  maxCookingTime?: number;
  categories?: RecipeCategory[];
  favoritesOnly?: boolean;
  pantryOnly?: boolean;
  type?: LibraryTypeFilter;
  /** An explicit sort orders a search too; only `none` still ranks. */
  sortBeatsRank?: boolean;
  /** Say, for each recipe of a search, which field matched. */
  withMatch?: boolean;
};

/** One row of the Library, discriminated by what kind of thing it is. */
export type LibraryListItem =
  | { kind: "recipe"; recipe: RecipeDashboardDTO; match?: LibraryMatchDTO }
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
    (params.ingredientIds?.length ?? 0) > 0 ||
    params.favoritesOnly === true ||
    params.pantryOnly === true
  );
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
 * Recipe-only filters — rating, cooking time, categories, tags, favourites, pantry —
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
    searchFields = ["title", "ingredients"],
    tags,
    ingredientIds,
    filterMode = "AND",
    sortMode = "dateDesc",
    minRating,
    maxCookingTime,
    categories,
    favoritesOnly,
    pantryOnly,
    type = "all",
    sortBeatsRank = false,
    withMatch = false,
  } = params;
  // Text with no search terms ("^", "  ") is no text: no title filter, no pinning, the plain sort.
  const search = hasSearchText(params.search) ? params.search : undefined;
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
  // Recipes with something at home, most complete first (#679).
  const pantryCoverage = pantryOnly ? pantryCoverageSql(ctx.householdId) : undefined;

  if (includeRecipes) {
    const conditions: SQL[] = [];
    const policyCondition = await buildPolicyCondition(ctx, recipes.householdId, "view");

    if (policyCondition) conditions.push(policyCondition as SQL);
    if (searchSql) conditions.push(searchSql.match);

    if (categories?.length) {
      conditions.push(recipeCarriesFoldsSql("category", categories));
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

    // Tags and Ingredients are one All/Any group: every one of them, or at least one.
    const tagAndIngredientClauses: SQL[] = [];

    if (tags?.length) {
      // Across households a Tag filter matches on the folded name (ADR-0043).
      const folds = new Set(tags.map(entryFold));

      tagAndIngredientClauses.push(
        recipeCarriesFoldsSql("tag", tags, filterMode === "AND" ? folds.size : 1)
      );
    }

    for (const id of new Set(ingredientIds)) {
      tagAndIngredientClauses.push(sql`EXISTS (
        SELECT 1 FROM recipe_ingredients filter_line
        WHERE filter_line.recipe_id = "recipes"."id" AND ${lineNamesKindSql("filter_line", [id])}
      )`);
    }

    if (tagAndIngredientClauses.length) {
      conditions.push(
        sql`(${sql.join(tagAndIngredientClauses, filterMode === "AND" ? sql` AND ` : sql` OR `)})`
      );
    }

    branches.push(sql`
      SELECT 'recipe'::text AS kind,
             "recipes"."id" AS id,
             "recipes"."name" AS title,
             "recipes"."created_at" AS created_at,
             0 AS pinned,
             ${searchSql ? searchSql.rank : sql`0::real`} AS rank,
             ${pantryCoverage ?? sql`NULL::real`} AS pantry_coverage
      FROM ${recipes}
      ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
  }

  if (includeCookbooks) {
    const conditions: SQL[] = [];
    const policyCondition = await buildPolicyCondition(ctx, cookbooks.householdId, "view");

    if (policyCondition) conditions.push(policyCondition as SQL);
    if (cookbookTitleCondition) conditions.push(sql`(${cookbookTitleCondition})`);

    branches.push(sql`
      SELECT 'cookbook'::text AS kind,
             "cookbooks"."id" AS id,
             "cookbooks"."title" AS title,
             "cookbooks"."created_at" AS created_at,
             ${search ? sql`1` : sql`0`} AS pinned,
             0::real AS rank,
             NULL::real AS pantry_coverage
      FROM ${cookbooks}
      ${conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);
  }

  const union = sql.join(branches, sql` UNION ALL `);
  const baseOrder = LIBRARY_ORDER_BY[sortMode] ?? LIBRARY_ORDER_BY.dateDesc;
  const relevanceFirst = Boolean(search) && !(sortBeatsRank && sortMode !== "none");
  const orderBy = sql`ORDER BY ${sql.join(
    [
      ...(pantryCoverage ? [sql`pantry_coverage DESC`] : []),
      ...(relevanceFirst ? [sql`pinned DESC, rank DESC`] : []),
      baseOrder,
      sql`id ASC`,
    ],
    sql`, `
  )}`;
  const where = pantryCoverage ? sql`WHERE pantry_coverage > 0` : sql``;

  const [pageResult, totalResult] = await Promise.all([
    db.execute(
      sql`WITH library AS (${union}) SELECT kind, id, pantry_coverage FROM library ${where} ${orderBy} LIMIT ${limit} OFFSET ${offset}`
    ),
    db.execute(sql`WITH library AS (${union}) SELECT COUNT(*)::int AS total FROM library ${where}`),
  ]);

  const page = rowsOf<{ kind: string; id: string; pantry_coverage: number | null }>(pageResult);
  const total = Number(rowsOf<{ total: number | string }>(totalResult)[0]?.total ?? 0);

  const pageRecipeIds = page.filter((row) => row.kind === "recipe").map((row) => row.id);
  const [recipeCards, cookbookCards, matches] = await Promise.all([
    listDashboardRecipesByIds(pageRecipeIds),
    listCookbooksByIds(
      ctx,
      page.filter((row) => row.kind === "cookbook").map((row) => row.id)
    ),
    // The text's match wins; without text, the line that satisfied the Ingredient filter.
    withMatch
      ? search
        ? recipeSearchMatches(pageRecipeIds, search, searchFields)
        : recipeIngredientMatches(pageRecipeIds, [...new Set(ingredientIds)])
      : undefined,
  ]);

  const recipesById = new Map(recipeCards.map((recipe) => [recipe.id, recipe]));
  const cookbooksById = new Map(cookbookCards.map((cookbook) => [cookbook.id, cookbook]));

  const items = page.flatMap<LibraryListItem>((row) => {
    if (row.kind === "recipe") {
      const recipe = recipesById.get(row.id);

      if (!recipe) return [];

      const match = matches?.get(row.id);

      return [
        {
          kind: "recipe" as const,
          recipe:
            row.pantry_coverage === null
              ? recipe
              : { ...recipe, pantryCoverage: row.pantry_coverage },
          ...(match ? { match } : {}),
        },
      ];
    }

    const cookbook = cookbooksById.get(row.id);

    return cookbook ? [{ kind: "cookbook" as const, cookbook }] : [];
  });

  return { items, total };
}

/** How many Categories and Tags Search offers with no text. */
const DISCOVER_CATEGORIES = 4;
const DISCOVER_TAGS = 12;

/** What Search offers with no text: up to four of the reader's Categories holding a visible recipe,
 * built-ins first in their fixed order, and the reader's Tags most used over visible recipes. */
export async function listLibraryDiscover(ctx: RecipeListContext): Promise<LibraryDiscoverDTO> {
  const visible = (await buildPolicyCondition(ctx, recipes.householdId, "view")) ?? sql`true`;
  const [categoryRows, tagNames] = await Promise.all([
    // A Category's photo is the newest visible recipe that has an image; none when no recipe does.
    db.execute(sql`
      SELECT DISTINCT ON (own.name_fold) own.name AS name, ${PRIMARY_IMAGE_SQL} AS image
      FROM ${categories} own
      JOIN ${categories} carried ON carried.name_fold = own.name_fold
      JOIN ${recipeCategories} link ON link.category_id = carried.id
      JOIN ${recipes} ON ${recipes.id} = link.recipe_id
      WHERE ${inScope(ctx.householdId, { offered: true, alias: sql.raw("own") })} AND ${visible}
      ORDER BY own.name_fold, own.household_id NULLS FIRST,
        (${PRIMARY_IMAGE_SQL} IS NULL), ${recipes.createdAt} DESC, ${recipes.id} DESC
    `),
    namesOnVisible(TAG_NAMES, ctx.householdId, visible, DISCOVER_TAGS),
  ]);
  const builtInRank = (name: string) => {
    const rank = (BUILT_IN_CATEGORIES as readonly string[]).indexOf(name);

    return rank === -1 ? BUILT_IN_CATEGORIES.length : rank;
  };
  const picked = rowsOf<{ name: string; image: string | null }>(categoryRows)
    .sort(
      (a, b) =>
        builtInRank(a.name) - builtInRank(b.name) ||
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    )
    .slice(0, DISCOVER_CATEGORIES);

  return { categories: picked, tags: tagNames };
}

/** How many of each kind the typing state offers. */
const SUGGESTIONS_PER_KIND = 3;

/** The Ingredients and the reader's Tags whose word starts with `text` and that narrow to a visible
 * recipe, most used first and `except` left out before the cap; the reader's Categories likewise. */
export async function listLibrarySuggestions(
  ctx: RecipeListContext,
  text: string,
  except: { ingredientIds: string[]; tags: string[] } = { ingredientIds: [], tags: [] }
): Promise<LibrarySuggestionsDTO> {
  const search = parseIngredientSearch(text, { fields: ["name", "translations"] });

  if (!search) return { ingredients: [], tags: [], categories: [] };

  const visible = (await buildPolicyCondition(ctx, recipes.householdId, "view")) ?? sql`true`;
  const [foods, tagNames, categoryNames] = await Promise.all([
    matchedFoods(visible, search, except.ingredientIds),
    namesOnVisible(
      TAG_NAMES,
      ctx.householdId,
      and(
        visible,
        nameStartsWith(tagsTable.name, search.fold),
        except.tags.length ? notInArray(tagsTable.nameFold, except.tags.map(entryFold)) : undefined
      ),
      SUGGESTIONS_PER_KIND
    ),
    namesOnVisible(CATEGORY_NAMES, ctx.householdId, visible),
  ]);
  const localeNames = await findLocaleNames(foods.map((food) => food.id));

  return {
    ingredients: foods.map((food) => ({ ...food, localeNames: localeNames.get(food.id) ?? {} })),
    tags: tagNames,
    categories: categoryNames,
  };
}

/** The text-matched Ingredients with the distinct visible recipes narrowing to each returns (the
 * recipes naming it or a kind of it), most first. The walk down the kinds starts at the matches. */
async function matchedFoods(visible: SQL, search: IngredientSearch, except: string[]) {
  const roots = except.length
    ? sql`${matchingSearch(search, undefined, true)} AND ${ingredients.id} NOT IN (${uuidListSql(except)})`
    : matchingSearch(search, undefined, true);
  const result = await db.execute(sql`
    WITH RECURSIVE ${kindWalkSql(sql`SELECT ${ingredients.id} FROM ${ingredients} WHERE ${roots}`)}
    SELECT ${ingredients.id} AS id, ${ingredients.name} AS name
    FROM kinds
    JOIN ${ingredients} ON ${ingredients.id} = kinds.root
    JOIN ${ingredientAliases} spelling ON spelling.ingredient_id = kinds.ingredient_id
    JOIN ${recipeIngredientFoods} food ON food.ingredient_alias_id = spelling.id
    JOIN ${recipeIngredients} line ON line.id = food.recipe_ingredient_id
    JOIN ${recipes} ON ${recipes.id} = line.recipe_id
    WHERE ${visible}
    GROUP BY ${ingredients.id}, ${ingredients.name}
    ORDER BY count(DISTINCT ${recipes.id}) DESC, lower(${ingredients.name}) ASC, ${ingredients.id} ASC
    LIMIT ${SUGGESTIONS_PER_KIND}
  `);

  return rowsOf<{ id: string; name: string }>(result);
}

type NamedEntity = {
  entity: {
    table: PgTable;
    name: AnyPgColumn;
    nameFold: AnyPgColumn;
    householdId: AnyPgColumn;
  };
  /** The same table again, as the entries recipes carry: any household's of the reader's fold. */
  carried: { table: PgTable; id: AnyPgColumn; nameFold: AnyPgColumn };
  link: { table: PgTable; recipeId: AnyPgColumn; entityId: AnyPgColumn };
};

const carriedTags = alias(tagsTable, "carried");
const carriedCategories = alias(categories, "carried");

const TAG_NAMES: NamedEntity = {
  entity: {
    table: tagsTable,
    name: tagsTable.name,
    nameFold: tagsTable.nameFold,
    householdId: tagsTable.householdId,
  },
  carried: { table: carriedTags, id: carriedTags.id, nameFold: carriedTags.nameFold },
  link: { table: recipeTags, recipeId: recipeTags.recipeId, entityId: recipeTags.tagId },
};

const CATEGORY_NAMES: NamedEntity = {
  entity: {
    table: categories,
    name: categories.name,
    nameFold: categories.nameFold,
    householdId: categories.householdId,
  },
  carried: {
    table: carriedCategories,
    id: carriedCategories.id,
    nameFold: carriedCategories.nameFold,
  },
  link: {
    table: recipeCategories,
    recipeId: recipeCategories.recipeId,
    entityId: recipeCategories.categoryId,
  },
};

/**
 * The household's and the instance's entries (Tags or Categories) whose fold a recipe satisfying
 * `where` carries, in any household, most such recipes first; an instance entry's name wins.
 */
async function namesOnVisible(
  { entity, carried, link }: NamedEntity,
  householdId: string,
  where: SQL | undefined,
  limit?: number
): Promise<string[]> {
  const query = db
    .select({
      name: sql<string>`(array_agg(${entity.name} ORDER BY ${entity.householdId} NULLS FIRST, ${entity.name}))[1]`,
    })
    .from(entity.table)
    .innerJoin(carried.table, eq(carried.nameFold, entity.nameFold))
    .innerJoin(link.table, eq(link.entityId, carried.id))
    .innerJoin(recipes, eq(recipes.id, link.recipeId))
    .where(and(or(eq(entity.householdId, householdId), isNull(entity.householdId)), where))
    .groupBy(entity.nameFold)
    .orderBy(desc(sql`count(distinct ${recipes.id})`), asc(entity.nameFold))
    .$dynamic();
  const rows = await (limit === undefined ? query : query.limit(limit));

  return rows.map((row) => row.name);
}
