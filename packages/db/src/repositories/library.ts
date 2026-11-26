import type { SQL, SQLWrapper } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  and,
  asc,
  avg,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

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
import type { LineReadings } from "@norish/shared/lib/line-foods";
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
import { inCatalogue, inScope } from "./household-scope";
import { findLocaleNames } from "./ingredient-aliases";
import { matchingSearch, nameStartsWith } from "./ingredient-catalogue";
import { kindWalkSql, lineNamesKindSql } from "./ingredient-kinds";
import { recipeCarriesFoldsSql } from "./list-entries";
import { pantryCoverageSql } from "./pantry-coverage";
import { recipeIngredientMatches, recipeSearchMatches } from "./recipe-matches";
import { PRIMARY_IMAGE_SQL } from "./recipe-primary-image";
import { buildPolicyCondition, listDashboardRecipesByIds, recipeSearchSql } from "./recipes";

const qb = new QueryBuilder();
const filterLine = alias(recipeIngredients, "filter_line");

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
  /** With `pantryOnly`, the lines read through the reader's catalogue (`lineReadingsOf`). */
  lineReadings?: LineReadings;
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
const LIBRARY_ORDER_BY: Record<
  SortOrder,
  (row: { title: SQLWrapper; createdAt: SQLWrapper }) => SQL
> = {
  titleAsc: (row) => asc(row.title),
  titleDesc: (row) => desc(row.title),
  dateAsc: (row) => asc(row.createdAt),
  dateDesc: (row) => desc(row.createdAt),
  none: (row) => desc(row.createdAt),
};

/** A Library row as both kinds' branches of the union select it. */
type LibraryFields = {
  kind: SQL.Aliased<string>;
  id: SQL.Aliased<string>;
  title: SQL.Aliased<string>;
  createdAt: SQL.Aliased<string>;
  pinned: SQL.Aliased<number>;
  rank: SQL.Aliased<number>;
  pantryCoverage: SQL.Aliased<number | null>;
};

function libraryBranch(fields: LibraryFields, table: PgTable, conditions: SQL[]) {
  return qb
    .select(fields)
    .from(table)
    .where(and(...conditions));
}

type LibraryBranch = ReturnType<typeof libraryBranch>;

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

  const branches: LibraryBranch[] = [];
  // Recipes with something at home, most complete first (#679).
  const pantryCoverage = pantryOnly
    ? pantryCoverageSql(ctx.householdId, params.lineReadings)
    : undefined;

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
        (${recipes.totalMinutes} IS NOT NULL
          OR ${recipes.prepMinutes} IS NOT NULL
          OR ${recipes.cookMinutes} IS NOT NULL)
        AND (CASE WHEN ${recipes.totalMinutes} IS NOT NULL THEN ${recipes.totalMinutes}
                  ELSE COALESCE(${recipes.prepMinutes}, 0) + COALESCE(${recipes.cookMinutes}, 0)
             END) <= ${maxCookingTime}
      )`);
    }

    if (minRating !== undefined) {
      // In SQL rather than post-fetch, so a page of the union has no gaps.
      const rating = qb
        .select({ rating: avg(recipeRatings.rating) })
        .from(recipeRatings)
        .where(eq(recipeRatings.recipeId, recipes.id));

      conditions.push(sql`COALESCE(${rating}, -1) >= ${minRating}`);
    }

    if (favoritesOnly) {
      conditions.push(
        exists(
          qb
            .select({ recipeId: recipeFavorites.recipeId })
            .from(recipeFavorites)
            .where(
              and(eq(recipeFavorites.recipeId, recipes.id), eq(recipeFavorites.userId, ctx.userId))
            )
        )
      );
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
      tagAndIngredientClauses.push(
        exists(
          qb
            .select({ id: filterLine.id })
            .from(filterLine)
            .where(and(eq(filterLine.recipeId, recipes.id), lineNamesKindSql(filterLine.id, [id])))
        )
      );
    }

    if (tagAndIngredientClauses.length) {
      const group =
        filterMode === "AND" ? and(...tagAndIngredientClauses) : or(...tagAndIngredientClauses);

      if (group) conditions.push(group);
    }

    branches.push(
      libraryBranch(
        {
          kind: sql<string>`'recipe'::text`.as("kind"),
          id: sql<string>`${recipes.id}`.as("id"),
          title: sql<string>`${recipes.name}`.as("title"),
          createdAt: sql<string>`${recipes.createdAt}`.as("created_at"),
          pinned: sql<number>`0`.as("pinned"),
          rank: sql<number>`${searchSql ? searchSql.rank : sql`0::real`}`.as("rank"),
          pantryCoverage: sql<number | null>`${pantryCoverage ?? sql`NULL::real`}`.as(
            "pantry_coverage"
          ),
        },
        recipes,
        conditions
      )
    );
  }

  if (includeCookbooks) {
    const conditions: SQL[] = [];
    const policyCondition = await buildPolicyCondition(ctx, cookbooks.householdId, "view");

    if (policyCondition) conditions.push(policyCondition as SQL);
    if (cookbookTitleCondition) conditions.push(sql`(${cookbookTitleCondition})`);

    branches.push(
      libraryBranch(
        {
          kind: sql<string>`'cookbook'::text`.as("kind"),
          id: sql<string>`${cookbooks.id}`.as("id"),
          title: sql<string>`${cookbooks.title}`.as("title"),
          createdAt: sql<string>`${cookbooks.createdAt}`.as("created_at"),
          pinned: sql<number>`${search ? sql`1` : sql`0`}`.as("pinned"),
          rank: sql<number>`0::real`.as("rank"),
          pantryCoverage: sql<number | null>`NULL::real`.as("pantry_coverage"),
        },
        cookbooks,
        conditions
      )
    );
  }

  const [first, second] = branches;

  if (!first) return { items: [], total: 0 };

  const library = db.$with("library").as(second ? first.unionAll(second) : first);
  const baseOrder = (LIBRARY_ORDER_BY[sortMode] ?? LIBRARY_ORDER_BY.dateDesc)(library);
  const relevanceFirst = Boolean(search) && !(sortBeatsRank && sortMode !== "none");
  const where = pantryCoverage ? gt(library.pantryCoverage, 0) : undefined;

  const [page, [totalRow]] = await Promise.all([
    db
      .with(library)
      .select({ kind: library.kind, id: library.id, pantryCoverage: library.pantryCoverage })
      .from(library)
      .where(where)
      .orderBy(
        ...(pantryCoverage ? [desc(library.pantryCoverage)] : []),
        ...(relevanceFirst ? [desc(library.pinned), desc(library.rank)] : []),
        baseOrder,
        asc(library.id)
      )
      .limit(limit)
      .offset(offset),
    db.with(library).select({ total: count() }).from(library).where(where),
  ]);
  const total = totalRow?.total ?? 0;

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
            row.pantryCoverage === null
              ? recipe
              : { ...recipe, pantryCoverage: row.pantryCoverage },
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
    db
      .selectDistinctOn([ownCategories.nameFold], {
        name: ownCategories.name,
        image: PRIMARY_IMAGE_SQL,
      })
      .from(ownCategories)
      .innerJoin(carriedCategories, eq(carriedCategories.nameFold, ownCategories.nameFold))
      .innerJoin(recipeCategories, eq(recipeCategories.categoryId, carriedCategories.id))
      .innerJoin(recipes, eq(recipes.id, recipeCategories.recipeId))
      .where(and(inScope(ownCategories.householdId, ctx.householdId, { offered: true }), visible))
      .orderBy(
        ownCategories.nameFold,
        sql`${ownCategories.householdId} NULLS FIRST`,
        sql`(${PRIMARY_IMAGE_SQL} IS NULL)`,
        desc(recipes.createdAt),
        desc(recipes.id)
      ),
    namesOnVisible(TAG_NAMES, ctx.householdId, visible, DISCOVER_TAGS),
  ]);
  const builtInRank = (name: string) => {
    const rank = (BUILT_IN_CATEGORIES as readonly string[]).indexOf(name);

    return rank === -1 ? BUILT_IN_CATEGORIES.length : rank;
  };
  const picked = categoryRows
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
    matchedFoods(ctx.householdId, visible, search, except.ingredientIds),
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
  const localeNames = await findLocaleNames(
    ctx.householdId,
    foods.map((food) => food.id)
  );

  return {
    ingredients: foods.map((food) => ({ ...food, localeNames: localeNames.get(food.id) ?? {} })),
    tags: tagNames,
    categories: categoryNames,
  };
}

/** The text-matched Ingredients with the distinct visible recipes narrowing to each returns (the
 * recipes naming it or a kind of it), most first. The walk down the kinds starts at the matches. */
async function matchedFoods(
  householdId: string,
  visible: SQL,
  search: IngredientSearch,
  except: string[]
) {
  const roots = qb
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      and(
        inCatalogue(ingredients.householdId, householdId),
        matchingSearch(search, householdId, undefined, true),
        except.length ? notInArray(ingredients.id, except) : undefined
      )
    );
  // No recursive CTE in the builder: the walk is SQL over the schema, read through a builder query.
  const walked = db
    .$with("walked", {
      root: sql<string>`root`.as("root"),
      // Named apart from the joined tables' columns: a CTE's columns render unqualified.
      kindId: sql<string>`kind_id`.as("kind_id"),
    })
    .as(
      sql`with recursive ${kindWalkSql(sql`${roots}`)} select root, ingredient_id as kind_id from kinds`
    );

  return await db
    .with(walked)
    .select({ id: ingredients.id, name: ingredients.name })
    .from(walked)
    .innerJoin(ingredients, eq(ingredients.id, walked.root))
    .innerJoin(ingredientAliases, eq(ingredientAliases.ingredientId, walked.kindId))
    .innerJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.ingredientAliasId, ingredientAliases.id)
    )
    .innerJoin(
      recipeIngredients,
      eq(recipeIngredients.id, recipeIngredientFoods.recipeIngredientId)
    )
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .where(visible)
    .groupBy(ingredients.id, ingredients.name)
    .orderBy(desc(countDistinct(recipes.id)), sql`lower(${ingredients.name})`, asc(ingredients.id))
    .limit(SUGGESTIONS_PER_KIND);
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
const ownCategories = alias(categories, "own");
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
    .where(and(inScope(entity.householdId, householdId, { offered: true }), where))
    .groupBy(entity.nameFold)
    .orderBy(desc(sql`count(distinct ${recipes.id})`), asc(entity.nameFold))
    .$dynamic();
  const rows = await (limit === undefined ? query : query.limit(limit));

  return rows.map((row) => row.name);
}
